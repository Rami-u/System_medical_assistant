import argparse
import pickle
import torch
from torchvision import transforms
from PIL import Image
import numpy as np

from model import NutritionCNN


def load_model(pkl_path: str, device: str = None):
    """Load the model and associated metadata from a pickle payload.

    Returns a tuple of (model, means, stds, targets, img_size).
    """
    with open(pkl_path, 'rb') as f:
        payload = pickle.load(f)
    # Recreate model architecture
    model = NutritionCNN(num_outputs=len(payload['targets']))
    model.load_state_dict(payload['model_state_dict'])
    model.to(device or ('cuda' if torch.cuda.is_available() else 'cpu'))
    model.eval()
    return model, payload['means'], payload['stds'], payload['targets'], payload['img_size']


def get_transform(img_size: int):
    """Return the validation transform identical to training pipeline."""
    return transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])


def denormalize(label_norm: np.ndarray, means: dict, stds: dict, targets: list):
    """Convert normalized label back to original scale using the given target order."""
    mean_arr = np.array([means[t] for t in targets], dtype=np.float32)
    std_arr = np.array([stds[t] for t in targets], dtype=np.float32)
    return label_norm * (std_arr + 1e-8) + mean_arr


def predict_image(image_path: str, pkl_path: str = 'nutrition_cnn.pkl'):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model, means, stds, targets, img_size = load_model(pkl_path, device)
    transform = get_transform(img_size)
    img = Image.open(image_path).convert('RGB')
    img_tensor = transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        pred_norm = model(img_tensor).cpu().numpy().squeeze()
    pred = denormalize(pred_norm, means, stds, targets)
    return dict(zip(sorted(targets), pred.tolist()))


def main():
    parser = argparse.ArgumentParser(description='Run inference using the trained NutritionCNN')
    parser.add_argument('image_path', type=str, help='Path to the image file')
    parser.add_argument('--pkl', type=str, default='nutrition_cnn.pkl', help='Path to the saved model pickle')
    parser.add_argument('--output', type=str, default=None,
                        help='Optional output JSON file to write predictions')
    args = parser.parse_args()

    result = predict_image(args.image_path, args.pkl)
    print('Predicted nutrition values:')
    for k, v in result.items():
        print(f'  {k}: {v:.2f}')
    if args.output:
        import json
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)


if __name__ == '__main__':
    main()
