"""
Retrain NutritionCNN on Google Colab
====================================
Upload this script + your data to Colab, then run:
    !python retrain_colab.py --epochs 60 --batch-size 32 --use-amp

After training finishes, download the new `nutrition_cnn.pkl` and replace
the one in `System_medical_assistant/models/nutrition_cnn.pkl`.
No code changes needed in the backend.
"""

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split, Dataset
from torchvision import transforms, models
from PIL import Image
import pickle
import numpy as np
import pandas as pd
import os
import argparse
import random
from tqdm import tqdm


# ── Model (MobileNetV2 backbone) ─────────────────────────────────────────────

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

        in_features = self.backbone.classifier[1].in_features
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
            nn.Linear(128, num_outputs)
        )
        self._init_weights()

    def _init_weights(self):
        for layer in self.backbone.classifier:
            if isinstance(layer, nn.Linear):
                nn.init.kaiming_normal_(layer.weight, mode='fan_out', nonlinearity='relu')
                nn.init.constant_(layer.bias, 0)

    def unfreeze_all(self):
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("All layers unfrozen for fine-tuning")

    def forward(self, x):
        return self.backbone(x)


# ── Dataset ───────────────────────────────────────────────────────────────────

class NutritionDataset(Dataset):
    def __init__(self, csv_path, img_dir, dish_ids_file, transform=None):
        self.df = pd.read_csv(csv_path)
        self.img_dir = img_dir
        self.transform = transform

        with open(dish_ids_file) as f:
            valid_ids = set(line.strip() for line in f)

        # Also filter to images that actually exist on disk
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
            img = Image.new('RGB', (224, 224), color=0)

        if self.transform:
            img = self.transform(img)

        label = (self.df[self.targets].iloc[idx].values.astype(np.float32)
                 - self.means.values.astype(np.float32)) / (self.stds.values.astype(np.float32) + 1e-8)

        return img, torch.tensor(label, dtype=torch.float32)


# ── Training ──────────────────────────────────────────────────────────────────

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def main():
    parser = argparse.ArgumentParser(description='Retrain NutritionCNN')
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--lr', type=float, default=0.001)
    parser.add_argument('--lr-finetune', type=float, default=1e-5)
    parser.add_argument('--img-size', type=int, default=224)
    parser.add_argument('--unfreeze-epoch', type=int, default=15)
    parser.add_argument('--patience', type=int, default=15)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--train-ids', type=str, default='train_ids.txt')
    parser.add_argument('--csv', type=str, default='dishes.csv')
    parser.add_argument('--img-dir', type=str, default='images/')
    parser.add_argument('--val-split', type=float, default=0.2)
    parser.add_argument('--num-workers', type=int, default=2)
    parser.add_argument('--use-amp', action='store_true')
    parser.add_argument('--resume', type=str, default=None, help='Path to checkpoint to resume from')
    args = parser.parse_args()

    set_seed(args.seed)

    DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Device: {DEVICE}")

    # Transforms
    train_transform = transforms.Compose([
        transforms.Resize((args.img_size + 32, args.img_size + 32)),
        transforms.RandomCrop(args.img_size),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(20),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    val_transform = transforms.Compose([
        transforms.Resize((args.img_size, args.img_size)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Dataset
    dataset = NutritionDataset(args.csv, args.img_dir, args.train_ids, train_transform)
    if len(dataset) < 10:
        print(f"\nERROR: Only {len(dataset)} images found! Need the full dataset.")
        print("Make sure your images/ directory contains all training images.")
        return

    val_size = int(args.val_split * len(dataset))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(
        dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(args.seed)
    )
    val_ds.dataset.transform = val_transform

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers, pin_memory=True)

    print(f"Train: {train_size} | Val: {val_size}")

    # Model
    model = NutritionCNN(num_outputs=4).to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, verbose=True)
    scaler = torch.cuda.amp.GradScaler() if args.use_amp and DEVICE == 'cuda' else None

    start_epoch = 0
    best_val_loss = float('inf')
    history = {'train_loss': [], 'val_loss': [], 'lr': []}

    # Resume from checkpoint if specified
    if args.resume:
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

    # Training loop
    patience_count = 0
    finetuning = start_epoch >= args.unfreeze_epoch

    if finetuning:
        model.unfreeze_all()

    for epoch in range(start_epoch, args.epochs):
        if epoch + 1 == args.unfreeze_epoch and not finetuning:
            model.unfreeze_all()
            for g in optimizer.param_groups:
                g['lr'] = args.lr_finetune
            finetuning = True
            print(f"\nFine-tuning ON - LR={args.lr_finetune}")

        # Train
        model.train()
        train_loss = 0.0
        for imgs, labels in tqdm(train_loader, desc=f"Ep {epoch+1}/{args.epochs} [Train]", leave=False):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            with torch.cuda.amp.autocast(enabled=args.use_amp):
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
                with torch.cuda.amp.autocast(enabled=args.use_amp):
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
            print(f"  BEST checkpoint saved (val_loss={val_loss:.4f})")
        else:
            patience_count += 1
            print(f"  No improvement ({patience_count}/{args.patience})")

        if patience_count >= args.patience:
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    # Export final model
    print("\nExporting final model...")
    best_ckpt = torch.load('best_checkpoint.pth', map_location=DEVICE)
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()

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

    print(f"\nSaved: nutrition_cnn.pkl")
    print(f"Best val loss: {best_ckpt['best_val_loss']:.4f}")
    print(f"Epochs trained: {len(best_ckpt['history']['train_loss'])}")
    print("\nCopy nutrition_cnn.pkl to System_medical_assistant/models/ to use it.")


if __name__ == '__main__':
    main()
