"""Dataset loading and the train/val/test split.

The split is the single most important reproducibility detail in this repo.
It is defined here, once, and both training and evaluation import it — so the
metrics in METRICS.md are guaranteed to be measured on images the model never
saw during training.

Expected layout (ImageFolder convention):

    ai/data/
      brown_spot/*.jpg
      healthy/*.jpg
      hispa/*.jpg
      leaf_blast/*.jpg

Source dataset: the rice leaf disease images published on Kaggle
("Rice Leaf Diseases" / rice-diseases-image-dataset). Download it, arrange it
into the four folders above, and both scripts work unchanged.
"""

from __future__ import annotations

import os
from pathlib import Path

import torch
from torch.utils.data import DataLoader, Subset
from torchvision import transforms
from torchvision.datasets import ImageFolder

from config import BASE_DIR, CLASSES
from disease_model import IMAGENET_MEAN, IMAGENET_STD

DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))

# Fixed seed => the same split every run, on every machine.
SPLIT_SEED = 42
SPLIT_RATIOS = (0.70, 0.15, 0.15)  # train / val / test

# Augmentation is applied to the training set only. Flips and mild colour
# jitter are safe for leaf disease: a lesion is still the same lesion mirrored
# or under different light. Vertical flips are included because farmers hold
# the phone at arbitrary angles.
train_transform = transforms.Compose(
    [
        transforms.Resize((256, 256)),
        transforms.RandomCrop(224),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)

# Validation and test see the deterministic transform — identical to the one
# used at inference time in disease_model.py.
eval_transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)


def _split_indices(n: int) -> tuple[list[int], list[int], list[int]]:
    generator = torch.Generator().manual_seed(SPLIT_SEED)
    permutation = torch.randperm(n, generator=generator).tolist()

    n_train = int(SPLIT_RATIOS[0] * n)
    n_val = int(SPLIT_RATIOS[1] * n)

    return (
        permutation[:n_train],
        permutation[n_train : n_train + n_val],
        permutation[n_train + n_val :],
    )


def load_splits(batch_size: int = 32, num_workers: int = 2):
    """Return (train_loader, val_loader, test_loader, class_names)."""
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"Dataset directory {DATA_DIR} not found. See the docstring in "
            "ai/dataset.py for the expected layout."
        )

    # Two ImageFolder instances over the same files: one carrying the
    # augmenting transform, one the deterministic transform. The Subsets below
    # then pick disjoint indices from each.
    augmented = ImageFolder(DATA_DIR, transform=train_transform)
    plain = ImageFolder(DATA_DIR, transform=eval_transform)

    if augmented.classes != CLASSES:
        raise ValueError(
            f"Class folders {augmented.classes} do not match CLASSES {CLASSES}. "
            "Class order matters — the model's output indices are bound to it."
        )

    train_idx, val_idx, test_idx = _split_indices(len(augmented))

    def loader(dataset, indices, shuffle):
        return DataLoader(
            Subset(dataset, indices),
            batch_size=batch_size,
            shuffle=shuffle,
            num_workers=num_workers,
        )

    return (
        loader(augmented, train_idx, True),
        loader(plain, val_idx, False),
        loader(plain, test_idx, False),
        augmented.classes,
    )
