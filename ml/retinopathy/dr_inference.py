"""
DRInferenceService — EfficientNet-B4 regression model for Diabetic Retinopathy grading.

Input: image path / numpy array / PIL Image / bytes
Output: { grade: int, label: str, confidence: float, raw_score: float, recommendation: str }
Grades: 0=No DR, 1=Mild, 2=Moderate, 3=Severe, 4=Proliferative DR
Uses: EfficientNet-B4 regression + circle crop preprocessing + 3-view TTA
"""

import io
import json
import logging
from pathlib import Path

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

CONFIG_PATH = Path("ml/retinopathy/dr_model_config.json")
MODEL_PATH = Path("ml/retinopathy/best_dr_model.pth")


def _circle_crop(img: Image.Image) -> Image.Image:
    """Apply circle crop preprocessing — masks non-retina regions."""
    img_array = np.array(img)
    h, w = img_array.shape[:2]

    # Create circular mask
    center = (w // 2, h // 2)
    radius = min(center[0], center[1])
    Y, X = np.ogrid[:h, :w]
    dist_from_center = np.sqrt((X - center[0]) ** 2 + (Y - center[1]) ** 2)
    mask = dist_from_center <= radius

    # Apply mask
    result = img_array.copy()
    result[~mask] = 0

    return Image.fromarray(result)


class DRInferenceService:
    """Manages the EfficientNet-B4 DR regression model."""

    _model = None
    _config: dict = {}
    _thresholds: list[float] = []
    _labels: list[str] = []
    _img_size: int = 380
    _loaded: bool = False

    @classmethod
    def load(cls) -> None:
        """Load the DR model and config from disk."""
        import torch
        from torchvision import models as tv_models
        import torch.nn as nn

        if cls._loaded:
            return

        # Load config
        if not CONFIG_PATH.exists():
            raise FileNotFoundError(f"DR config not found: {CONFIG_PATH}")
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"DR model not found: {MODEL_PATH}")

        with open(CONFIG_PATH) as f:
            cls._config = json.load(f)

        cls._thresholds = cls._config["thresholds"]
        cls._labels = cls._config["labels"]
        cls._img_size = cls._config.get("img_size", 380)

        logger.info("Loading DR model: %s (img_size=%d)", cls._config["model_name"], cls._img_size)

        # Build EfficientNet-B4 with single regression output
        model = tv_models.efficientnet_b4(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(in_features, 1),
        )

        state_dict = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)

        # Handle various checkpoint formats
        if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
            state_dict = state_dict["model_state_dict"]

        # Try loading directly first; if that fails, strip "model." prefix
        try:
            model.load_state_dict(state_dict, strict=True)
        except RuntimeError:
            cleaned = {k.replace("model.", "", 1): v for k, v in state_dict.items()}
            model.load_state_dict(cleaned, strict=True)

        model.eval()
        cls._model = model
        cls._loaded = True

        metrics = cls._config.get("metrics", {})
        logger.info(
            "✓ DR model loaded: QWK=%.4f, Accuracy=%.2f%%",
            metrics.get("test_qwk", 0),
            metrics.get("test_accuracy", 0),
        )

    @classmethod
    def is_loaded(cls) -> bool:
        return cls._loaded

    @classmethod
    def predict(cls, image_input) -> dict:
        """
        Run DR inference on an image.

        Args:
            image_input: bytes, PIL Image, numpy array, or file path string

        Returns:
            {grade, label, confidence, raw_score, recommendation}
        """
        import torch
        from torchvision import transforms

        if not cls._loaded:
            raise RuntimeError("DR model not loaded. Call DRInferenceService.load() first.")

        # Convert input to PIL Image
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            pil_img = Image.fromarray(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            pil_img = image_input.convert("RGB")
        elif isinstance(image_input, (str, Path)):
            pil_img = Image.open(str(image_input)).convert("RGB")
        else:
            raise ValueError(f"Unsupported input type: {type(image_input)}")

        # Preprocessing
        norm_mean = cls._config["normalization"]["mean"]
        norm_std = cls._config["normalization"]["std"]

        preprocess = transforms.Compose([
            transforms.Resize((cls._img_size, cls._img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=norm_mean, std=norm_std),
        ])

        # 3-view TTA: original + circle-cropped + horizontally flipped
        cropped = _circle_crop(pil_img)
        flipped = pil_img.transpose(Image.FLIP_LEFT_RIGHT)

        views = [preprocess(v).unsqueeze(0) for v in [pil_img, cropped, flipped]]

        # Run inference
        with torch.no_grad():
            scores = [float(cls._model(v).squeeze()) for v in views]

        # Average TTA scores
        raw_score = sum(scores) / len(scores)

        # Apply thresholds to determine grade
        grade = 0
        for i, threshold in enumerate(cls._thresholds):
            if raw_score >= threshold:
                grade = i + 1
            else:
                break

        label = cls._labels[grade]

        # Confidence: distance from nearest threshold boundary
        if grade == 0:
            margin = cls._thresholds[0] - raw_score
            confidence = min(95.0, max(50.0, 50.0 + margin * 30.0))
        elif grade == len(cls._thresholds):
            margin = raw_score - cls._thresholds[-1]
            confidence = min(95.0, max(50.0, 50.0 + margin * 30.0))
        else:
            lower = cls._thresholds[grade - 1]
            upper = cls._thresholds[grade] if grade < len(cls._thresholds) else raw_score + 1
            range_width = upper - lower
            mid = (lower + upper) / 2
            dist_from_edge = abs(raw_score - mid) / (range_width / 2)
            confidence = min(95.0, max(50.0, 50.0 + (1.0 - dist_from_edge) * 45.0))

        confidence = round(confidence, 1)

        # Recommendation based on grade
        recommendations = {
            0: "No signs of diabetic retinopathy detected. Continue annual eye exams.",
            1: "Mild non-proliferative DR detected. Schedule a follow-up with an ophthalmologist within 6-12 months.",
            2: "Moderate non-proliferative DR detected. Consult an ophthalmologist within 3-6 months. Monitor blood sugar closely.",
            3: "Severe non-proliferative DR detected. Urgent referral to a retina specialist recommended within 1 month.",
            4: "Proliferative DR detected. Immediate referral to a retina specialist required. Treatment may be needed urgently.",
        }

        result = {
            "grade": grade,
            "label": label,
            "confidence": confidence,
            "raw_score": round(raw_score, 4),
            "recommendation": recommendations[grade],
        }

        logger.info(
            "DR prediction: grade=%d (%s), confidence=%.1f%%, raw_score=%.4f",
            grade, label, confidence, raw_score,
        )

        return result
