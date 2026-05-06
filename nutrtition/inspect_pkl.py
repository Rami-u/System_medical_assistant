"""Inspect nutrition_cnn.pkl contents."""
import pickle
import torch
import io

class CPUUnpickler(pickle.Unpickler):
    """Unpickler that maps CUDA tensors to CPU."""
    def find_class(self, module, name):
        if module == 'torch.storage' and name == '_load_from_bytes':
            return lambda b: torch.load(io.BytesIO(b), map_location='cpu', weights_only=False)
        return super().find_class(module, name)

with open('nutrtition/nutrition_cnn.pkl', 'rb') as f:
    payload = CPUUnpickler(f).load()

print("=" * 60)
print("PKL CONTENTS")
print("=" * 60)
print(f"Keys: {list(payload.keys())}")
print(f"\nmeans: {payload.get('means')}")
print(f"\nstds: {payload.get('stds')}")
print(f"\ntargets: {payload.get('targets')}")
print(f"\nimg_size: {payload.get('img_size')}")
print(f"\nbest_val_loss: {payload.get('best_val_loss')}")

# Check state dict keys
sd = payload.get('model_state_dict', {})
keys = list(sd.keys())
print(f"\nState dict keys count: {len(keys)}")
print(f"First 5: {keys[:5]}")
print(f"Last 5: {keys[-5:]}")

# Check classifier shape
for k in keys:
    if 'classifier' in k:
        print(f"  {k}: {sd[k].shape}")
