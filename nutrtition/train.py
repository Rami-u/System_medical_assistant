# train.py
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import transforms
from tqdm import tqdm
import pickle
import numpy as np
from dataset import NutritionDataset
from model import NutritionCNN


import argparse
import random


def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

def main():
    parser = argparse.ArgumentParser(description='Train NutritionCNN model')
    parser.add_argument('--epochs', type=int, default=50, help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=32, help='Batch size')
    parser.add_argument('--lr', type=float, default=0.001, help='Initial learning rate')
    parser.add_argument('--lr-finetune', type=float, default=1e-5, help='Learning rate after unfreeze')
    parser.add_argument('--img-size', type=int, default=224, help='Image size for training')
    parser.add_argument('--unfreeze-epoch', type=int, default=20, help='Epoch to unfreeze backbone')
    parser.add_argument('--patience', type=int, default=10, help='Early stopping patience')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    parser.add_argument('--train-ids', type=str, default='train_ids.txt', help='File with training dish IDs')
    parser.add_argument('--val-split', type=float, default=0.2, help='Validation split proportion')
    parser.add_argument('--num-workers', type=int, default=0, help='Number of DataLoader workers')
    parser.add_argument('--use-amp', action='store_true', help='Enable mixed precision training')
    args = parser.parse_args()

    set_seed(args.seed)

    # ── Config ────────────────────────────────────────────────────────────────
    EPOCHS          = args.epochs
    BATCH_SIZE      = args.batch_size
    LR              = args.lr
    LR_FINETUNE     = args.lr_finetune
    IMG_SIZE        = args.img_size
    UNFREEZE_EPOCH  = args.unfreeze_epoch
    PATIENCE        = args.patience
    VAL_SPLIT       = args.val_split
    NUM_WORKERS     = args.num_workers
    USE_AMP         = args.use_amp
    DEVICE          = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using: {DEVICE}")

    # ── Transforms ────────────────────────────────────────────────────────────
    train_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(20),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225])
    ])

    val_transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225])
    ])

    # ── Dataset ───────────────────────────────────────────────────────────────
    dataset = NutritionDataset(
        csv_path='dishes.csv',
        img_dir='images/',
        dish_ids_file=args.train_ids,
        transform=train_transform
    )

    print(f"Total dataset size: {len(dataset)}")

    val_size   = int(VAL_SPLIT * len(dataset))
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(
        dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(args.seed)
    )
    val_ds.dataset.transform = val_transform

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=NUM_WORKERS, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=True)

    print(f"Train: {train_size} | Val: {val_size}")

    # ── Model ─────────────────────────────────────────────────────────────────
    model = NutritionCNN(num_outputs=4).to(DEVICE)
    print("\n── Model Params ──")
    model.count_params()

    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3, verbose=True)

    # ── Mixed Precision ───────────────────────────────────────────────────────
    scaler = torch.cuda.amp.GradScaler() if USE_AMP and DEVICE == 'cuda' else None

    # ── Combined Loss ─────────────────────────────────────────────────────────
    def criterion(preds, targets):
        mse = nn.MSELoss()(preds, targets)
        mae = nn.L1Loss()(preds, targets)
        return mse + 0.5 * mae

    # ── Training Loop ─────────────────────────────────────────────────────────
    best_val_loss  = float('inf')
    patience_count = 0
    finetuning     = False
    history        = {'train_loss': [], 'val_loss': [], 'lr': []}

    for epoch in range(EPOCHS):
        # ── Unfreeze backbone at UNFREEZE_EPOCH ───────────────────────────────
        if epoch + 1 == UNFREEZE_EPOCH and not finetuning:
            model.unfreeze_all()
            for g in optimizer.param_groups:
                g['lr'] = LR_FINETUNE
            finetuning = True
            print(f"\n🔓 Fine-tuning mode ON — LR dropped to {LR_FINETUNE}")
            print("── Updated Params ──")
            model.count_params()

        # ── Train ─────────────────────────────────────────────────────────────
        model.train()
        train_loss = 0.0
        loop = tqdm(train_loader, desc=f"Epoch {epoch+1:02d}/{EPOCHS} [Train]", leave=False)
        for imgs, labels in loop:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            with torch.cuda.amp.autocast(enabled=USE_AMP):
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
            loop.set_postfix(loss=f"{loss.item():.4f}")

        # ── Validate ──────────────────────────────────────────────────────────
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            loop = tqdm(val_loader, desc=f"Epoch {epoch+1:02d}/{EPOCHS} [Val]  ", leave=False)
            for imgs, labels in loop:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                with torch.cuda.amp.autocast(enabled=USE_AMP):
                    preds = model(imgs)
                    batch_loss = criterion(preds, labels)
                val_loss += batch_loss.item()
                loop.set_postfix(loss=f"{val_loss:.4f}")

        train_loss /= len(train_loader)
        val_loss   /= len(val_loader)
        current_lr  = optimizer.param_groups[0]['lr']

        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['lr'].append(current_lr)

        scheduler.step(val_loss)

        phase = "🔓 FT" if finetuning else "🔒 FR"
        print(f"{phase} | Epoch {epoch+1:02d}/{EPOCHS} | "
              f"Train: {train_loss:.4f} | "
              f"Val: {val_loss:.4f} | "
              f"LR: {current_lr:.6f}")

        # ── Save Best ─────────────────────────────────────────────────────────
        if val_loss < best_val_loss:
            best_val_loss  = val_loss
            patience_count = 0
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_val_loss': best_val_loss,
                'history': history,
                'scaler_state_dict': scaler.state_dict() if scaler else None
            }
            torch.save(checkpoint, 'best_checkpoint.pth')
            print(f"  ✅ Best checkpoint saved (val_loss={val_loss:.4f})")
        else:
            patience_count += 1
            print(f"  ⚠️  No improvement ({patience_count}/{PATIENCE})")

        # ── Early Stopping ────────────────────────────────────────────────────
        if patience_count >= PATIENCE:
            print(f"\n⛔ Early stopping at epoch {epoch+1}")
            break

    # ── Load Best Model for Export ─────────────────────────────────────────────
    print("\nLoading best model weights...")
    best_ckpt = torch.load('best_checkpoint.pth', map_location=DEVICE)
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()

    pkl_payload = {
        'model_state_dict': model.state_dict(),
        'means':            dataset.means.to_dict(),
        'stds':             dataset.stds.to_dict(),
        'targets':          dataset.targets,
        'img_size':         IMG_SIZE,
        'history':          best_ckpt['history'],
        'best_val_loss':    best_ckpt['best_val_loss']
    }

    with open('nutrition_cnn.pkl', 'wb') as f:
        pickle.dump(pkl_payload, f)

    print(f"\n✅ Saved: nutrition_cnn.pkl")
    print(f"   Best val loss : {best_ckpt['best_val_loss']:.4f}")
    print(f"   Epochs trained: {len(best_ckpt['history']['train_loss'])}")

    # ── Loss Curve Summary ────────────────────────────────────────────────────
    print("\n── Loss Curve ──")
    for i, (t, v, lr) in enumerate(zip(best_ckpt['history']['train_loss'],
                                        best_ckpt['history']['val_loss'],
                                        best_ckpt['history']['lr'])):
        marker = " 👑" if v == best_ckpt['best_val_loss'] else ""
        ft_tag = " 🔓" if i + 1 >= UNFREEZE_EPOCH else ""
        bar    = '█' * int((1 - v) * 20) if v < 1 else ''
        print(f"  Ep {i+1:02d} | Train: {t:.4f} | Val: {v:.4f} {bar}{marker}{ft_tag}")


if __name__ == '__main__':
    main()