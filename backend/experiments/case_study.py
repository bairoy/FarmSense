"""Case-study inference + Grad-CAM++ on the five real field photos supplied for
the paper (Desktop/test_images). Writes predictions to results/case_study.json
and the heatmap overlays to results/case_study_fig/.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))

from PIL import Image

from disease_model import predict_disease

IMG_DIR = Path("/Users/baijuyadav/Desktop/test_images")
OUT = Path(__file__).resolve().parent / "results"
FIGDIR = OUT / "case_study_fig"
FIGDIR.mkdir(parents=True, exist_ok=True)

results = []
for f in sorted(IMG_DIR.glob("*")):
    if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    img = Image.open(f).convert("RGB")
    r = predict_disease(img, heatmap=True)
    heat_bytes = r.pop("heatmap_jpeg")
    out_path = FIGDIR / f"{f.stem}_original.jpg"
    img.save(out_path, quality=90)
    heat_path = FIGDIR / f"{f.stem}_cam.jpg"
    heat_path.write_bytes(heat_bytes)
    ranked = sorted(r["probabilities"].items(), key=lambda kv: -kv[1])[:3]
    print(f"{f.name}: top-3 {ranked}  margin={r['margin']}")
    results.append({"file": f.name, "disease": r["disease"], "confidence": r["confidence"],
                     "margin": r["margin"], "top3": ranked})

(OUT / "case_study.json").write_text(json.dumps(results, indent=2))
print(f"\nWritten to {OUT / 'case_study.json'} and {FIGDIR}")
