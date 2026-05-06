"""
Download Nutrition5k overhead images locally via HTTPS.
First lists available images from the GCS bucket, then downloads them.

Usage:
    python download_images.py

Downloads all available overhead food images into the images/ folder.
"""

import os
import requests
import concurrent.futures
from PIL import Image
from io import BytesIO
import time

GCS_API = "https://storage.googleapis.com/storage/v1/b/nutrition5k_dataset/o"
GCS_BASE = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(SCRIPT_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)


def list_available_dishes():
    """List all dish IDs that have overhead images in the GCS bucket."""
    print("Scanning GCS bucket for available overhead images...")
    prefix = "nutrition5k_dataset/imagery/realsense_overhead/"
    dish_ids = []
    page_token = None

    while True:
        params = {
            "prefix": prefix,
            "delimiter": "/",
            "maxResults": 1000,
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(GCS_API, params=params, timeout=30)
        data = resp.json()

        prefixes = data.get("prefixes", [])
        for p in prefixes:
            # Extract dish_id from: nutrition5k_dataset/imagery/realsense_overhead/dish_XXXX/
            dish_id = p.rstrip("/").split("/")[-1]
            if dish_id.startswith("dish_"):
                dish_ids.append(dish_id)

        page_token = data.get("nextPageToken")
        print(f"  Found {len(dish_ids)} dishes so far...", end="\r", flush=True)

        if not page_token:
            break

    print(f"  Found {len(dish_ids)} dishes with overhead images")
    return dish_ids


def download_one(dish_id):
    """Download a single overhead RGB image."""
    dst_path = os.path.join(IMAGES_DIR, f"{dish_id}.jpg")
    if os.path.exists(dst_path):
        return "skip"

    url = f"{GCS_BASE}/imagery/realsense_overhead/{dish_id}/rgb.png"
    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            img = Image.open(BytesIO(resp.content)).convert("RGB")
            img.save(dst_path, "JPEG", quality=95)
            return "ok"
        else:
            return f"http_{resp.status_code}"
    except Exception as e:
        return f"error"


def main():
    print("=" * 60)
    print("Nutrition5k Image Downloader")
    print("=" * 60)

    # Step 1: Find which dishes actually have overhead images
    available = list_available_dishes()

    if not available:
        print("ERROR: Could not list bucket contents. Check internet connection.")
        return

    # Check existing
    existing = set(
        f.replace(".jpg", "") for f in os.listdir(IMAGES_DIR) if f.endswith(".jpg")
    )
    to_download = [d for d in available if d not in existing]
    print(f"\nTotal available: {len(available)}")
    print(f"Already downloaded: {len(existing)}")
    print(f"Remaining: {len(to_download)}")

    if not to_download:
        print("\n✅ All images already downloaded!")
        return

    # Step 2: Download
    print(f"\nDownloading {len(to_download)} images...")

    ok = 0
    errors = 0
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(download_one, d): d for d in to_download}
        total = len(futures)

        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            if result == "ok" or result == "skip":
                ok += 1
            else:
                errors += 1

            elapsed = time.time() - start_time
            speed = i / elapsed if elapsed > 0 else 0
            eta = (total - i) / speed if speed > 0 else 0
            print(
                f"\r  [{i:>5}/{total}] ✅ {ok} downloaded, ❌ {errors} errors | "
                f"{speed:.1f} img/s | ETA: {eta/60:.1f}min",
                end="", flush=True
            )

    total_images = len([f for f in os.listdir(IMAGES_DIR) if f.endswith(".jpg")])
    elapsed = time.time() - start_time

    print(f"\n\n{'=' * 60}")
    print(f"Done in {elapsed/60:.1f} minutes")
    print(f"Total images in folder: {total_images}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
