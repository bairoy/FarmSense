"""Train the rice leaf disease classifier.

    python ai/train_rice_model.py --epochs 15

Produces `ai/rice_model.pth`. Run `ai/eval_disease_model.py` afterwards to
generate the metrics that belong in ai/METRICS.md — never quote an accuracy
number that did not come out of that script.

Approach: transfer learning from ImageNet-pretrained ResNet-18. The dataset is
a few thousand images across four classes, which is far too small to train a
CNN from scratch, but plenty to fine-tune one whose early layers already know
about edges, texture and colour blotches.
"""

from __future__ import annotations

import argparse
import json
import time

import torch
from torch import nn
from torchvision import models

from config import CLASSES, MODEL_PATH
from dataset import SPLIT_RATIOS, SPLIT_SEED, load_splits

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def build_pretrained_model(num_classes: int) -> nn.Module:
    """ResNet-18 with ImageNet weights and a fresh classification head."""
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def run_epoch(model, loader, criterion, optimizer=None) -> tuple[float, float]:
    """One pass over `loader`. Trains when an optimizer is supplied."""
    training = optimizer is not None
    model.train(training)

    total_loss = 0.0
    correct = 0
    seen = 0

    with torch.set_grad_enabled(training):
        for images, labels in loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)

            outputs = model(images)
            loss = criterion(outputs, labels)

            if training:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * labels.size(0)
            correct += (outputs.argmax(1) == labels).sum().item()
            seen += labels.size(0)

    return total_loss / seen, correct / seen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    torch.manual_seed(SPLIT_SEED)

    train_loader, val_loader, _test_loader, class_names = load_splits(args.batch_size)
    print(f"Device: {DEVICE}  Classes: {class_names}")

    model = build_pretrained_model(len(CLASSES)).to(DEVICE)
    criterion = nn.CrossEntropyLoss()

    # Only the new head is trained at the higher rate; the pretrained backbone
    # is fine-tuned 10x slower so we adapt its features without destroying
    # them on a dataset this small.
    optimizer = torch.optim.Adam(
        [
            {"params": model.fc.parameters(), "lr": args.lr},
            {
                "params": (p for n, p in model.named_parameters() if not n.startswith("fc.")),
                "lr": args.lr / 10,
            },
        ]
    )
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=2)

    best_val_acc = 0.0
    history = []
    started = time.time()

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = run_epoch(model, train_loader, criterion, optimizer)
        val_loss, val_acc = run_epoch(model, val_loader, criterion)
        scheduler.step(val_loss)

        history.append(
            {
                "epoch": epoch,
                "train_loss": round(train_loss, 4),
                "train_acc": round(train_acc, 4),
                "val_loss": round(val_loss, 4),
                "val_acc": round(val_acc, 4),
            }
        )
        print(
            f"epoch {epoch:02d}  train {train_acc:.3f} ({train_loss:.3f})  "
            f"val {val_acc:.3f} ({val_loss:.3f})"
        )

        # Checkpoint on best *validation* accuracy, not the last epoch. The
        # last epoch is often past the point of overfitting.
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), MODEL_PATH)
            print(f"  saved -> {MODEL_PATH} (val_acc {val_acc:.3f})")

    run_card = {
        "classes": CLASSES,
        "split_seed": SPLIT_SEED,
        "split_ratios": SPLIT_RATIOS,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "best_val_accuracy": round(best_val_acc, 4),
        "minutes": round((time.time() - started) / 60, 2),
        "history": history,
    }
    (MODEL_PATH.parent / "training_run.json").write_text(json.dumps(run_card, indent=2))

    print(f"\nBest val accuracy {best_val_acc:.3f}")
    print("Now run: python ai/eval_disease_model.py")


if __name__ == "__main__":
    main()
