"""Out-of-distribution stress test of the shipped classifier (paper Section 4.8).

Run from the ai/ directory so imports and the uploads folder resolve:
    cd ai && venv/bin/python ../backend/experiments/e6_ood.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))  # the ai/ modules

import numpy as np
from PIL import Image, ImageFilter

from disease_model import predict_disease

OUT = Path(__file__).resolve().parent / "results"
rs = np.random.RandomState(0)  # fixed seed: results are reproducible
S = 224

solid = [(0,0,0),(255,255,255),(128,128,128),(64,64,64),(192,192,192),(255,0,0),(0,255,0),(0,0,255),(255,255,0),(0,255,255),
         (255,0,255),(34,139,34),(85,107,47),(107,142,35),(154,205,50),(60,120,40),(139,69,19),(210,180,140),(135,206,235),(255,165,0)]
sets = {"solid_colour": [Image.new("RGB", (S, S), c) for c in solid]}
sets["gaussian_noise"] = [Image.fromarray(np.clip(rs.normal(128, 60, (S, S, 3)), 0, 255).astype("uint8")) for _ in range(20)]

def grad(i):
    a = np.linspace(0, 1, S)[None, :, None] * np.ones((S, S, 3))
    a = a * rs.uniform(80, 255, (1, 1, 3)) + rs.uniform(0, 60, (1, 1, 3))
    return Image.fromarray(np.clip(a if i % 2 else a.transpose(1, 0, 2), 0, 255).astype("uint8"))
sets["gradient"] = [grad(i) for i in range(20)]

def stripes(_):
    a = np.zeros((S, S, 3)); w = rs.randint(4, 40)
    for x in range(0, S, 2 * w):
        a[:, x:x + w] = rs.uniform(0, 255, 3)
    return Image.fromarray(a.astype("uint8"))
sets["stripes"] = [stripes(i) for i in range(20)]

def greentex(_):
    base = rs.uniform(0.2, 0.6, (1, 1, 3)) * np.array([0.5, 1.0, 0.4]) * 255
    a = np.clip(base + rs.normal(0, 35, (S, S, 3)), 0, 255).astype("uint8")
    return Image.fromarray(a).filter(ImageFilter.GaussianBlur(rs.uniform(1, 4)))
sets["green_texture"] = [greentex(i) for i in range(20)]

pick = lambda r: {"disease": r["disease"], "confidence": r["confidence"], "margin": r["margin"]}
result = {
    "ood": {k: [pick(predict_disease(im)) for im in v] for k, v in sets.items()},
    "real": {f.name: pick(predict_disease(Image.open(f).convert("RGB"))) for f in sorted(Path("uploads").glob("*.jpeg"))},
}
(OUT / "e6_rerun.json").write_text(json.dumps(result))
conf = [r["confidence"] for v in result["ood"].values() for r in v]
print("OOD accepted at gate 0.65: %.0f%%" % (100 * np.mean([c >= 0.65 for c in conf])), "| mean confidence %.3f" % np.mean(conf))
