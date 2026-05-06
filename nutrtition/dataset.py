# dataset.py
import os
import pandas as pd
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset
from torchvision import transforms

class NutritionDataset(Dataset):
    def __init__(self, csv_path, img_dir, dish_ids_file, transform=None):
        self.df = pd.read_csv(csv_path)
        self.img_dir = img_dir
        self.transform = transform

        # Filter to only dishes we have images for
        with open(dish_ids_file) as f:
            valid_ids = set(line.strip() for line in f)

        self.df = self.df[self.df['dish_id'].isin(valid_ids)].reset_index(drop=True)

        # Normalize targets
        self.targets = ['total_calories', 'total_fat', 'total_carb', 'total_protein']
        self.means = self.df[self.targets].mean()
        self.stds  = self.df[self.targets].std()

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row     = self.df.iloc[idx]
        img_path = os.path.join(self.img_dir, f"{row['dish_id']}.jpg")

        # Load image
        try:
            img = Image.open(img_path).convert('RGB')
        except:
            img = Image.new('RGB', (224, 224), color=0)

        if self.transform:
            img = self.transform(img)

        # Normalize targets
        label = (self.df[self.targets].iloc[idx].values.astype(np.float32)
                 - self.means.values.astype(np.float32)) / (self.stds.values.astype(np.float32) + 1e-8)

        return img, torch.tensor(label, dtype=torch.float32)