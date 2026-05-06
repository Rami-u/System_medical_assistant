"""
Download Nutrition5k dataset + Train CNN — ALL ON GOOGLE COLAB
==============================================================
You DON'T need to download 180GB. This script only downloads:
  - Overhead images (~2-3 GB, only the images you need)
  - Metadata CSV (~1 MB)
  - Train/test split files (~100 KB)

HOW TO USE:
1. Open Google Colab: https://colab.research.google.com
2. Select GPU runtime: Runtime > Change runtime type > T4 GPU
3. Upload ONLY this single file to Colab
4. Run in a cell:
       !python colab_download_and_train.py --epochs 60 --batch-size 32 --use-amp
5. Download the resulting nutrition_cnn.pkl
6. Place it in System_medical_assistant/models/nutrition_cnn.pkl

Total download: ~2-3 GB (NOT 180GB — we skip all videos)
Total time: ~30-60 minutes on T4 GPU
"""

import os
import subprocess
import sys
import argparse


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1: Download dataset from Google Cloud Storage directly to Colab
# ═════════════════════════════════════════════════════════════════════════════

def _is_colab():
    """Detect if running inside Google Colab."""
    try:
        import google.colab  # noqa
        return True
    except ImportError:
        return False


def _get_dataset_dir():
    """Return the dataset directory based on environment."""
    if _is_colab():
        return "/content/nutrition5k"
    else:
        # Running locally — use the current directory (nutrtition/)
        return os.path.dirname(os.path.abspath(__file__)) or "."


def download_dataset(dataset_dir):
    """Download ONLY the required files from Nutrition5k GCS bucket."""
    BASE = "gs://nutrition5k_dataset/nutrition5k_dataset"

    os.makedirs(dataset_dir, exist_ok=True)
    os.makedirs(os.path.join(dataset_dir, "images"), exist_ok=True)

    print("=" * 60)
    print("STEP 1: Downloading dataset from Google Cloud Storage")
    print("       (Only overhead images + metadata — NOT the full 180GB)")
    print(f"       Target directory: {dataset_dir}")
    print("=" * 60)

    # 1a. Download metadata CSVs (~1 MB)
    print("\n[1/3] Downloading metadata CSVs...")
    subprocess.run([
        "gsutil", "-m", "cp", "-r",
        f"{BASE}/metadata/",
        os.path.join(dataset_dir, "metadata") + "/"
    ], check=True)

    # 1b. Download train/test split files (~100 KB)
    print("\n[2/3] Downloading train/test split files...")
    subprocess.run([
        "gsutil", "-m", "cp", "-r",
        f"{BASE}/dish_ids/",
        os.path.join(dataset_dir, "dish_ids") + "/"
    ], check=True)

    # 1c. Download overhead RGB images ONLY (~2-3 GB, skip depth + videos)
    print("\n[3/3] Downloading overhead RGB images (this takes ~5-10 minutes)...")
    print("       Downloading ~5000 images from Google Cloud...")
    subprocess.run([
        "gsutil", "-m", "cp", "-r",
        f"{BASE}/imagery/realsense_overhead/",
        os.path.join(dataset_dir, "imagery", "realsense_overhead") + "/"
    ], check=True)

    print("\nDownload complete!")
    return dataset_dir


def prepare_images(dataset_dir):
    """
    Convert the Nutrition5k directory structure into a flat images/ folder.
    Nutrition5k stores images as:
      imagery/realsense_overhead/dish_XXXXXXXXXX/rgb.png
    We need:
      images/dish_XXXXXXXXXX.jpg
    """
    import shutil
    from PIL import Image

    src_dir = os.path.join(dataset_dir, "imagery", "realsense_overhead")
    dst_dir = os.path.join(dataset_dir, "images")
    os.makedirs(dst_dir, exist_ok=True)

    if not os.path.exists(src_dir):
        print(f"WARNING: {src_dir} not found. Trying alternative structure...")
        # Maybe images are already flat
        return dst_dir

    print("\nConverting overhead images to flat JPEG format...")
    count = 0
    errors = 0
    for dish_dir in sorted(os.listdir(src_dir)):
        dish_path = os.path.join(src_dir, dish_dir)
        if not os.path.isdir(dish_path):
            continue

        rgb_path = os.path.join(dish_path, "rgb.png")
        if not os.path.exists(rgb_path):
            # Try other possible names
            for alt in ["rgb.jpg", "overhead_color.png", "color.png"]:
                alt_path = os.path.join(dish_path, alt)
                if os.path.exists(alt_path):
                    rgb_path = alt_path
                    break
            else:
                errors += 1
                continue

        dst_path = os.path.join(dst_dir, f"{dish_dir}.jpg")
        if os.path.exists(dst_path):
            count += 1
            continue

        try:
            img = Image.open(rgb_path).convert("RGB")
            img.save(dst_path, "JPEG", quality=95)
            count += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error converting {dish_dir}: {e}")

    print(f"Converted {count} images ({errors} errors)")
    return dst_dir


def prepare_csv(dataset_dir):
    """
    Combine the Nutrition5k metadata CSVs into a single dishes.csv
    compatible with the training script.
    """
    import pandas as pd

    csv_dir = os.path.join(dataset_dir, "metadata")
    output_csv = os.path.join(dataset_dir, "dishes.csv")

    if os.path.exists(output_csv):
        df = pd.read_csv(output_csv)
        print(f"dishes.csv already exists with {len(df)} entries")
        return output_csv

    dfs = []
    for csv_file in ["dish_metadata_cafe1.csv", "dish_metadata_cafe2.csv"]:
        path = os.path.join(csv_dir, csv_file)
        if os.path.exists(path):
            # Nutrition5k CSV has no header — columns are:
            # dish_id, total_calories, total_mass, total_fat, total_carb, total_protein, num_ingrs, ...
            df = pd.read_csv(path, header=None)
            # Only keep first 6 columns (dish-level nutrition)
            df = df.iloc[:, :6]
            df.columns = ["dish_id", "total_calories", "total_mass", "total_fat", "total_carb", "total_protein"]
            dfs.append(df)
            print(f"Loaded {len(df)} dishes from {csv_file}")

    if not dfs:
        raise FileNotFoundError(f"No metadata CSVs found in {csv_dir}")

    combined = pd.concat(dfs, ignore_index=True)

    # Clean up — remove rows with missing/zero values
    combined = combined.dropna(subset=["total_calories", "total_fat", "total_carb", "total_protein"])
    combined = combined[combined["total_calories"] > 0]

    combined.to_csv(output_csv, index=False)
    print(f"\nCreated dishes.csv with {len(combined)} dishes")
    return output_csv


def prepare_split_files(dataset_dir):
    """Extract train/test IDs from Nutrition5k split files."""
    splits_dir = os.path.join(dataset_dir, "dish_ids", "splits")

    train_file = os.path.join(dataset_dir, "train_ids.txt")
    test_file = os.path.join(dataset_dir, "test_ids.txt")

    if os.path.exists(train_file) and os.path.exists(test_file):
        with open(train_file) as f:
            train_count = sum(1 for _ in f)
        with open(test_file) as f:
            test_count = sum(1 for _ in f)
        print(f"Split files exist: {train_count} train, {test_count} test")
        return train_file, test_file

    # Look for split files in the downloaded directory
    train_src = os.path.join(splits_dir, "train_ids.txt")
    test_src = os.path.join(splits_dir, "test_ids.txt")

    # Alternative: the split files might have different names
    if not os.path.exists(train_src):
        for f in os.listdir(splits_dir) if os.path.exists(splits_dir) else []:
            if "train" in f.lower():
                train_src = os.path.join(splits_dir, f)
            if "test" in f.lower():
                test_src = os.path.join(splits_dir, f)

    import shutil
    if os.path.exists(train_src):
        shutil.copy2(train_src, train_file)
    if os.path.exists(test_src):
        shutil.copy2(test_src, test_file)

    print(f"Split files prepared: train={train_file}, test={test_file}")
    return train_file, test_file


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2: Training (same as retrain_colab.py but self-contained)
# ═════════════════════════════════════════════════════════════════════════════

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split, Dataset
from torchvision import transforms, models
from PIL import Image
import pickle
import numpy as np
import pandas as pd
from tqdm import tqdm


class NutritionCNN(nn.Module):
    def __init__(self, num_outputs=4, freeze_layers=80):
        super().__init__()
        try:
            self.backbone = models.mobilenet_v2(weights='IMAGENET1K_V1')
        except TypeError:
            self.backbone = models.mobilenet_v2(pretrained=True)

        for i, (name, param) in enumerate(self.backbone.named_parameters()):
            if i < freeze_layers:
                param.requires_grad = False

        in_features = self.backbone.classifier[1].in_features  # 1280
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(in_features, 512),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(512),
            nn.Dropout(p=0.3),
            nn.Linear(512, 256),
            nn.ReLU(inplace=True),
            nn.BatchNorm1d(256),
            nn.Dropout(p=0.2),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, num_outputs),
        )

    def forward(self, x):
        return self.backbone(x)

    def unfreeze_all(self):
        for param in self.backbone.parameters():
            param.requires_grad = True
        print(f"Unfroze all layers ({sum(p.numel() for p in self.parameters())} params)")


class NutritionDataset(Dataset):
    def __init__(self, csv_path, img_dir, dish_ids_file, transform=None):
        self.df = pd.read_csv(csv_path)
        self.img_dir = img_dir
        self.transform = transform

        with open(dish_ids_file) as f:
            valid_ids = set(line.strip() for line in f)

        existing_imgs = set(
            f.replace('.jpg', '') for f in os.listdir(img_dir) if f.endswith('.jpg')
        )
        usable_ids = valid_ids.intersection(existing_imgs)

        self.df = self.df[self.df['dish_id'].isin(usable_ids)].reset_index(drop=True)
        self.targets = ['total_calories', 'total_fat', 'total_carb', 'total_protein']
        self.means = self.df[self.targets].mean()
        self.stds = self.df[self.targets].std()

        print(f"Dataset: {len(self.df)} dishes with images")
        print(f"Target means: {dict(self.means)}")
        print(f"Target stds:  {dict(self.stds)}")

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img_path = os.path.join(self.img_dir, f"{row['dish_id']}.jpg")
        try:
            img = Image.open(img_path).convert('RGB')
        except Exception:
            img = Image.new('RGB', (224, 224))

        if self.transform:
            img = self.transform(img)

        raw = row[self.targets].values.astype(np.float32)
        means = self.means.values.astype(np.float32)
        stds = self.stds.values.astype(np.float32)
        label = (raw - means) / (stds + 1e-8)

        return img, torch.tensor(label, dtype=torch.float32)


def train(args, dataset_dir):
    """Full training loop."""
    DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\nDevice: {DEVICE}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name()}")

    # Paths
    csv_path = os.path.join(dataset_dir, "dishes.csv")
    img_dir = os.path.join(dataset_dir, "images")
    train_ids = os.path.join(dataset_dir, "train_ids.txt")

    # Transforms
    train_transform = transforms.Compose([
        transforms.Resize((args.img_size + 32, args.img_size + 32)),
        transforms.RandomCrop(args.img_size),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((args.img_size, args.img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # Dataset
    full_dataset = NutritionDataset(csv_path, img_dir, train_ids, transform=train_transform)
    if len(full_dataset) < 50:
        print(f"\nERROR: Only {len(full_dataset)} images found! Need at least 50.")
        print("Make sure the download completed and images were converted.")
        return

    val_size = int(0.15 * len(full_dataset))
    train_size = len(full_dataset) - val_size
    train_ds, val_ds = random_split(
        full_dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )
    val_ds.dataset.transform = val_transform

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=2, pin_memory=True)

    print(f"\nTrain: {train_size} | Val: {val_size}")

    # Model
    model = NutritionCNN(num_outputs=4, freeze_layers=80).to(DEVICE)
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                                  lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    scaler = torch.amp.GradScaler('cuda') if args.use_amp and torch.cuda.is_available() else None

    best_val_loss = float('inf')
    history = {'train_loss': [], 'val_loss': [], 'lr': []}
    start_epoch = 0

    if args.resume and os.path.exists(args.resume):
        ckpt = torch.load(args.resume, map_location=DEVICE)
        model.load_state_dict(ckpt['model_state_dict'])
        optimizer.load_state_dict(ckpt['optimizer_state_dict'])
        best_val_loss = ckpt.get('best_val_loss', float('inf'))
        history = ckpt.get('history', history)
        start_epoch = ckpt.get('epoch', 0) + 1
        print(f"Resumed from epoch {start_epoch}, best_val_loss={best_val_loss:.4f}")

    def criterion(preds, targets):
        mse = nn.MSELoss()(preds, targets)
        mae = nn.L1Loss()(preds, targets)
        return mse + 0.5 * mae

    patience_count = 0
    finetuning = start_epoch >= args.unfreeze_epoch

    if finetuning:
        model.unfreeze_all()

    print(f"\nStarting training for {args.epochs} epochs...")
    print("=" * 60)

    for epoch in range(start_epoch, args.epochs):
        if epoch + 1 == args.unfreeze_epoch and not finetuning:
            model.unfreeze_all()
            for g in optimizer.param_groups:
                g['lr'] = args.lr_finetune
            finetuning = True

        # Train
        model.train()
        train_loss = 0.0
        for imgs, labels in tqdm(train_loader, desc=f"Ep {epoch+1}/{args.epochs} [Train]", leave=False):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            with torch.cuda.amp.autocast(enabled=args.use_amp and torch.cuda.is_available()):
                preds = model(imgs)
                loss = criterion(preds, labels)
            if scaler:
                scaler.scale(loss).backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                scaler.step(optimizer)
                scaler.update()
            else:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
            train_loss += loss.item()

        # Validate
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for imgs, labels in tqdm(val_loader, desc=f"Ep {epoch+1}/{args.epochs} [Val]", leave=False):
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                with torch.cuda.amp.autocast(enabled=args.use_amp and torch.cuda.is_available()):
                    preds = model(imgs)
                    val_loss += criterion(preds, labels).item()

        train_loss /= len(train_loader)
        val_loss /= len(val_loader)
        current_lr = optimizer.param_groups[0]['lr']

        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['lr'].append(current_lr)
        scheduler.step(val_loss)

        tag = "FT" if finetuning else "FR"
        print(f"[{tag}] Ep {epoch+1:02d}/{args.epochs} | Train: {train_loss:.4f} | Val: {val_loss:.4f} | LR: {current_lr:.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_count = 0
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_val_loss': best_val_loss,
                'history': history,
                'scaler_state_dict': scaler.state_dict() if scaler else None
            }, 'best_checkpoint.pth')
            print(f"  ★ BEST checkpoint saved (val_loss={val_loss:.4f})")
        else:
            patience_count += 1
            print(f"  No improvement ({patience_count}/{args.patience})")

        if patience_count >= args.patience:
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    # Export final model
    print("\n" + "=" * 60)
    print("Exporting final model...")
    best_ckpt = torch.load('best_checkpoint.pth', map_location=DEVICE)
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()

    dataset = full_dataset
    pkl_payload = {
        'model_state_dict': model.state_dict(),
        'means': dataset.means.to_dict(),
        'stds': dataset.stds.to_dict(),
        'targets': dataset.targets,
        'img_size': args.img_size,
        'history': best_ckpt['history'],
        'best_val_loss': best_ckpt['best_val_loss']
    }

    with open('nutrition_cnn.pkl', 'wb') as f:
        pickle.dump(pkl_payload, f)

    print(f"\n✅ Saved: nutrition_cnn.pkl")
    print(f"   Best val loss: {best_ckpt['best_val_loss']:.4f}")
    print(f"   Epochs trained: {len(best_ckpt['history']['train_loss'])}")
    print(f"\n📥 Download nutrition_cnn.pkl and place it in:")
    print(f"   System_medical_assistant/models/nutrition_cnn.pkl")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Download Nutrition5k + Train CNN')
    parser.add_argument('--skip-download', action='store_true', help='Skip download if already done')
    parser.add_argument('--data-dir', type=str, default=None, help='Override dataset directory')
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--lr', type=float, default=1e-3)
    parser.add_argument('--lr-finetune', type=float, default=1e-5)
    parser.add_argument('--unfreeze-epoch', type=int, default=10)
    parser.add_argument('--img-size', type=int, default=224)
    parser.add_argument('--patience', type=int, default=12)
    parser.add_argument('--use-amp', action='store_true', help='Use mixed precision training')
    parser.add_argument('--resume', type=str, default=None, help='Resume from checkpoint')
    args = parser.parse_args()

    # Auto-detect environment
    dataset_dir = args.data_dir or _get_dataset_dir()
    is_colab = _is_colab()
    is_local = not is_colab

    print(f"Environment: {'Google Colab' if is_colab else 'Local'}")
    print(f"Dataset dir: {dataset_dir}")

    # Check if local data already exists
    local_imgs = os.path.join(dataset_dir, "images")
    local_csv = os.path.join(dataset_dir, "dishes.csv")
    local_ids = os.path.join(dataset_dir, "train_ids.txt")
    has_local_data = (
        os.path.exists(local_imgs)
        and os.path.exists(local_csv)
        and os.path.exists(local_ids)
        and len([f for f in os.listdir(local_imgs) if f.endswith('.jpg')]) > 0
    )

    if has_local_data:
        img_count = len([f for f in os.listdir(local_imgs) if f.endswith('.jpg')])
        print(f"\nFound existing local data: {img_count} images")
        if img_count < 100 and not args.skip_download:
            print(f"WARNING: Only {img_count} images found. Results will be poor.")
            print("For best results, run this on Google Colab to download the full dataset.")
        # Skip download — use existing local data
        args.skip_download = True

    # Step 1: Download dataset (only on Colab or if no local data)
    if not args.skip_download:
        if is_local:
            print("\nNo local data found. To get the full dataset:")
            print("  1. Run this script on Google Colab (free GPU + fast GCS download)")
            print("  2. Or install gsutil and run with --data-dir pointing to your data")
            return
        download_dataset(dataset_dir)
    else:
        print("Using existing local data (--skip-download)")

    # Step 2: Prepare data (only needed if we downloaded from GCS)
    if not has_local_data:
        print("\n" + "=" * 60)
        print("STEP 2: Preparing dataset")
        print("=" * 60)
        prepare_csv(dataset_dir)
        prepare_images(dataset_dir)
        prepare_split_files(dataset_dir)
    else:
        print("\nLocal data ready — skipping preparation.")

    # Step 3: Train
    print("\n" + "=" * 60)
    print("STEP 3: Training CNN Model")
    print("=" * 60)
    train(args, dataset_dir)


if __name__ == '__main__':
    main()
