# model.py
import torch
import torch.nn as nn
from torchvision import models


class NutritionCNN(nn.Module):
    """Regression model based on MobileNetV2.

    The backbone is MobileNetV2 pre‑trained on ImageNet. Its original classifier is
    replaced by a small regression head that outputs ``num_outputs`` values (the
    four nutrition targets). Early layers can be frozen via the ``freeze_layers``
    argument; they can later be unfrozen with :meth:`unfreeze_all` during fine‑
    tuning.
    """
    def __init__(self, num_outputs=4, freeze_layers=80):
        super().__init__()

        # ── Backbone: MobileNetV2 (lightweight, suitable for limited resources) ───────
        # ``weights='IMAGENET1K_V1'`` works with recent torchvision versions; it falls
        # back to the older ``pretrained=True`` signature on older releases.
        try:
            self.backbone = models.mobilenet_v2(weights='IMAGENET1K_V1')
        except TypeError:  # older torchvision API
            self.backbone = models.mobilenet_v2(pretrained=True)

        # ── Freeze early parameters ────────────────────────────────────────────────
        for i, (name, param) in enumerate(self.backbone.named_parameters()):
            if i < freeze_layers:
                param.requires_grad = False

        # ── Replace MobileNetV2 classifier with a custom regression head ────────
        # MobileNetV2's original classifier is ``nn.Sequential(nn.Dropout(p=0.2),
        # nn.Linear(1280, 1000))``. The linear layer's ``in_features`` gives us the
        # dimension of the backbone's final feature representation.
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

        # ── Initialise head weights ───────────────────────────────────────────────
        self._init_weights()

    def _init_weights(self):
        for layer in self.backbone.classifier:
            if isinstance(layer, nn.Linear):
                nn.init.kaiming_normal_(layer.weight, mode='fan_out', nonlinearity='relu')
                nn.init.constant_(layer.bias, 0)

    def unfreeze_all(self):
        """Unfreeze the entire backbone for fine‑tuning."""
        for param in self.backbone.parameters():
            param.requires_grad = True
        print("✅ All layers unfrozen for fine‑tuning")

    def count_params(self):
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        frozen = total - trainable
        print(f"  Total params    : {total:,}")
        print(f"  Trainable params: {trainable:,}")
        print(f"  Frozen params   : {frozen:,}")

    def forward(self, x):
        return self.backbone(x)


if __name__ == '__main__':
    model = NutritionCNN(num_outputs=4)
    print("── Model Summary ──")
    model.count_params()

    # Test forward pass
    dummy = torch.randn(2, 3, 224, 224)
    out = model(dummy)
    print(f"  Input shape : {dummy.shape}")
    print(f"  Output shape: {out.shape}")   # should be [2, 4]

    print(f"  Output sample: {out[0].detach().numpy()}")