# Nutrition CNN Training

This directory contains the training code for the MobileNetV2 nutrition regression model.

## Important
- **Images and model weights are NOT included in this repo** (too large, ~5 GB)
- The trained model (`nutrition_cnn.pkl`) must be placed in `../models/` for the backend to use it

## Files
| File | Purpose |
|------|---------|
| `model.py` | NutritionCNN model architecture (MobileNetV2 + regression head) |
| `dataset.py` | PyTorch Dataset class for Nutrition5k |
| `train.py` | Local training script |
| `inference.py` | Standalone inference + denormalization |
| `retrain_colab.py` | Training script for Google Colab |
| `colab_download_and_train.py` | All-in-one: download dataset + train (Colab or local) |
| `download_images.py` | Download overhead images from GCS to local |
| `Nutrition5k_CNN_Training.ipynb` | Colab notebook version |
| `train_ids.txt` / `test_ids.txt` | Official Nutrition5k train/test split |

## How to Train

### Option 1: Google Colab (Recommended)
1. Upload `Nutrition5k_CNN_Training.ipynb` to [Google Colab](https://colab.research.google.com)
2. Select GPU runtime (T4)
3. Run all cells — images download directly from Google Cloud
4. Download the resulting `nutrition_cnn.pkl`

### Option 2: Local with GPU
```bash
python download_images.py          # Downloads ~3,500 images from GCS (~2-3 GB)
python colab_download_and_train.py --epochs 60 --batch-size 32 --use-amp
cp nutrition_cnn.pkl ../models/
```

## Dataset
[Nutrition5k](https://github.com/google-research-datasets/Nutrition5k) — 5,006 plates of food with nutritional annotations (Google Research, CVPR 2021).
