"""
AiService — conversation management with stub AI responses.

Uses selectinload to prevent N+1 when loading messages.
"""

from datetime import datetime, timezone
import io
import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

import json
import os
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

from app.models.ai_conversation import AiConversation, AiMessage
from app.models.patient_doctor import Patient
from app.schemas.ai_schemas import (
    AiChatRequest, AiConversationCreate, AiConversationListItem,
    AiConversationResponse, AiMessageResponse,
)

logger = logging.getLogger(__name__)

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY", "dummy_key")
genai.configure(api_key=api_key)


# ──────────────────────────────────────────────
# Pre-trained model management
# ──────────────────────────────────────────────

# ImageNet class labels for the food-detection CNN
# This list must match the training label order of best_model.pth
_FOOD_LABELS: list[str] = []


def _load_food_labels() -> list[str]:
    """Load class labels from labels.txt next to the model, or return a
    numeric fallback list."""
    labels_path = os.path.join("models", "labels.txt")
    if os.path.isfile(labels_path):
        with open(labels_path, encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    return []


class AIModelService:
    """
    Manages pre-trained scikit-learn and PyTorch models used for
    diabetes screening and food-image detection.
    """

    _simple_model = None
    _advanced_model = None
    _vision_model = None

    @classmethod
    def load_models(cls) -> None:
        """Load all three pre-trained models from the models/ directory."""
        import joblib
        import torch
        import torch.nn as nn
        from torchvision import models as tv_models

        global _FOOD_LABELS

        logger.info("Loading pre-trained models …")
        cls._simple_model = joblib.load("models/simple_model.pkl")
        cls._advanced_model = joblib.load("models/advanced_model.pkl")

        # ── Reconstruct the vision CNN from state_dict ──────────
        # The .pth file is a state_dict saved from a custom wrapper
        # around EfficientNet-B3 with a 4-class classifier head.
        state_dict = torch.load("models/best_model.pth", map_location="cpu")

        # Determine number of output classes from the final layer
        num_classes = state_dict["backbone.classifier.11.weight"].shape[0]

        # Build the same architecture used during training
        backbone = tv_models.efficientnet_b3(weights=None)
        backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(1536, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(p=0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, num_classes),
        )

        # The state_dict keys are prefixed with "backbone." — strip it
        cleaned = {
            k.replace("backbone.", "", 1): v
            for k, v in state_dict.items()
        }
        backbone.load_state_dict(cleaned, strict=True)
        backbone.eval()

        cls._vision_model = backbone
        _FOOD_LABELS = _load_food_labels()
        logger.info(
            "All models loaded successfully (vision model: %d classes).",
            num_classes,
        )

    @classmethod
    def models_ready(cls) -> bool:
        return all([cls._simple_model, cls._advanced_model, cls._vision_model])

    # ── Vision (food-image CNN) ──────────────────────────────
    @classmethod
    def run_vision_model(cls, image_bytes: bytes) -> dict | None:
        """
        Run the PyTorch CNN on raw image bytes.

        Returns {"food_name": str, "confidence_pct": float} for the
        top-1 prediction, or ``None`` when max confidence < 70 %
        (which signals the caller to fall back to Gemini Vision).
        """
        import torch
        from PIL import Image
        from torchvision import transforms

        preprocess = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ])

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = preprocess(img).unsqueeze(0)  # (1, 3, 224, 224)

        with torch.no_grad():
            logits = cls._vision_model(tensor)
            probs = torch.nn.functional.softmax(logits, dim=1)
            confidence, idx = probs.max(dim=1)

        confidence_pct = round(confidence.item() * 100, 2)
        class_idx = idx.item()

        if confidence_pct < 70.0:
            return None  # triggers Gemini fallback

        food_name = (
            _FOOD_LABELS[class_idx]
            if class_idx < len(_FOOD_LABELS)
            else f"class_{class_idx}"
        )

        return {"food_name": food_name, "confidence_pct": confidence_pct}



def _resolve_patient_id(user_id: int, db: Session) -> int:
    stmt = select(Patient.id).where(Patient.user_id == user_id)
    pid = db.execute(stmt).scalar_one_or_none()
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return pid


def _generate_ai_response(user_message: str) -> str:
    """Stub AI response — replace with real AI provider integration."""
    return (
        "Thank you for your message. I'm your Diacheck AI assistant. "
        "AI provider integration is pending — this is a placeholder response. "
        "Please consult your doctor for medical advice."
    )


def create_conversation(data: AiConversationCreate, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    convo = AiConversation(patient_id=patient_id, title=data.title or "New Conversation")
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return AiConversationResponse(
        id=convo.id, patient_id=convo.patient_id,
        title=convo.title, created_at=convo.created_at, messages=[],
    )


def send_message(conversation_id: int, data: AiChatRequest, user_id: int, db: Session) -> list[AiMessageResponse]:
    patient_id = _resolve_patient_id(user_id, db)

    # Verify conversation ownership
    stmt = select(AiConversation).where(
        AiConversation.id == conversation_id, AiConversation.patient_id == patient_id
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    # Save user message
    user_msg = AiMessage(conversation_id=conversation_id, sender="user", message_text=data.message)
    db.add(user_msg)
    db.flush()

    # Generate and save AI response
    ai_text = _generate_ai_response(data.message)
    ai_msg = AiMessage(conversation_id=conversation_id, sender="ai", message_text=ai_text)
    db.add(ai_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(ai_msg)

    return [AiMessageResponse.model_validate(user_msg), AiMessageResponse.model_validate(ai_msg)]


def get_conversations(user_id: int, db: Session, skip: int = 0, limit: int = 20) -> list[AiConversationListItem]:
    patient_id = _resolve_patient_id(user_id, db)

    stmt = (
        select(
            AiConversation.id, AiConversation.title, AiConversation.created_at,
            func.count(AiMessage.id).label("message_count"),
        )
        .outerjoin(AiMessage, AiMessage.conversation_id == AiConversation.id)
        .where(AiConversation.patient_id == patient_id)
        .group_by(AiConversation.id)
        .order_by(AiConversation.created_at.desc())
        .offset(skip).limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        AiConversationListItem(id=r.id, title=r.title, created_at=r.created_at, message_count=r.message_count)
        for r in rows
    ]


def get_conversation_detail(conversation_id: int, user_id: int, db: Session) -> AiConversationResponse:
    patient_id = _resolve_patient_id(user_id, db)
    stmt = (
        select(AiConversation)
        .options(selectinload(AiConversation.messages))
        .where(AiConversation.id == conversation_id, AiConversation.patient_id == patient_id)
    )
    convo = db.execute(stmt).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return AiConversationResponse.model_validate(convo)


# ──────────────────────────────────────────────
# Phase 4: Meal & Screening AI Integrations
# ──────────────────────────────────────────────

def analyze_meal_image(image_bytes: bytes, mime_type: str) -> dict:
    """
    Send an image to Gemini Vision to detect food items.
    Enforces a strict JSON output schema.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = (
        "Analyze this image of a meal and list the food items detected. "
        "Return strictly this JSON structure: "
        '{"items": [{"food_name": "string", "quantity_desc": "string", "confidence_pct": 0.0, "carbs_g": 0.0, "protein_g": 0.0, "fat_g": 0.0, "calories": 0}]}'
    )
    
    try:
        response = model.generate_content([
            prompt, 
            {"mime_type": mime_type, "data": image_bytes}
        ])
        
        # Clean up possible markdown wrappers
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())
    except GoogleAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {str(e)}"
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned invalid JSON format"
        )


def predict_screening_risk(answers_text: str) -> dict:
    """
    Send screening answers to Gemini to predict diabetes risk.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = (
        "Based on the following patient screening answers, assess the diabetes risk level. "
        "The answers are: " + answers_text + "\n\n"
        "Return strictly this JSON structure: "
        '{"risk_level": "Low" | "Medium" | "High", "confidence_pct": 0.0, "notes": "Brief explanation"}'
    )
    
    try:
        response = model.generate_content(prompt)
        
        # Clean up possible markdown wrappers
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        return json.loads(text.strip())
    except GoogleAPIError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI service unavailable: {str(e)}"
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI returned invalid JSON format"
        )
