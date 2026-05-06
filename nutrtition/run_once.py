# run_once.py — run this ONCE to download images
import subprocess
import os

# Download dish IDs list first
subprocess.run([
    "gsutil", "cp",
    "gs://nutrition5k_dataset/nutrition5k_dataset/dish_ids/splits/train_ids.txt",
    "train_ids.txt"
])
subprocess.run([
    "gsutil", "cp",
    "gs://nutrition5k_dataset/nutrition5k_dataset/dish_ids/splits/test_ids.txt",
    "test_ids.txt"
])

os.makedirs("images", exist_ok=True)

# Download only the overhead RGB image for each dish (not full videos)
with open("train_ids.txt") as f:
    dish_ids = [line.strip() for line in f.readlines()]

print(f"Downloading {len(dish_ids)} dish images...")

for dish_id in dish_ids[:4000]:   # start with 500, remove limit for full dataset
    dst = f"images/{dish_id}.jpg"
    if os.path.exists(dst):
        continue
    subprocess.run([
        "gsutil", "cp",
        f"gs://nutrition5k_dataset/nutrition5k_dataset/imagery/realsense_overhead/{dish_id}/rgb.png",
        dst
    ], capture_output=True)

print("Done downloading.")