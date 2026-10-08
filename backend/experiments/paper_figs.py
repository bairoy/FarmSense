"""Builds every figure for the rice-only FarmSense paper from the real result
files in experiments/results/. No numbers are invented here - this script only
plots what e1-e6(+_rice/_v2 reruns) already computed.

Run:  venv/bin/python paper_figs.py   (ai venv has matplotlib+numpy+PIL)
"""
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as md
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image
from pathlib import Path

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.titlesize": 9.5, "axes.titleweight": "bold",
    "figure.dpi": 200, "savefig.dpi": 200,
})

HERE = Path(__file__).resolve().parent
RES = HERE / "results"
FIG = HERE / "paper" / "fig"
FIG.mkdir(parents=True, exist_ok=True)

B, G, O, R, K, Y, P = "#2b6cb0", "#2f7d4f", "#c9691a", "#b83232", "#555555", "#8a6d00", "#7a4fa8"

load = lambda name: json.loads((RES / name).read_text())

# =====================================================================
# Fig 1: system architecture (clean horizontal-band layout with a legend
# and a numbered request flow overlaid on top of the component diagram)
# =====================================================================
fig, ax = plt.subplots(figsize=(8.6, 10.6)); ax.set_xlim(0, 120); ax.set_ylim(0, 150); ax.axis("off")

def box(x, y, w, h, t, sub=None, fc="#eef2ee", ec="#8aa08a", bold=True, fs=8.2, sub_fs=6.8, lw=1.3):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.4,rounding_size=1.4", fc=fc, ec=ec, lw=lw))
    ax.text(x + w / 2, y + h / 2 + (h * 0.20 if sub else 0), t, ha="center", va="center", fontsize=fs,
            fontweight="bold" if bold else "normal", color="#1a1a1a")
    if sub:
        ax.text(x + w / 2, y + h / 2 - h * 0.26, sub, ha="center", va="center", fontsize=sub_fs, color="#444")

def arr(a, b, c="#222", st="-|>", ls="-", rad=0, lw=1.4):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle=st, mutation_scale=11, lw=lw, color=c, ls=ls,
                                  connectionstyle=f"arc3,rad={rad}"))

BLUE_FILL, BLUE_EDGE = "#dce9fb", "#3f7fc9"
YEL_FILL, YEL_EDGE = "#fdf0d0", "#c9941a"
PUR_FILL, PUR_EDGE = "#ece8f8", "#8a7fc9"
GRN_FILL, GRN_EDGE = "#dff1e4", "#3f9a5c"
PNK_FILL, PNK_EDGE = "#fbe6ee", "#c75a85"
ORG_FILL, ORG_EDGE = "#fde6d2", "#d97a2e"
GRY_FILL, GRY_EDGE = "#ededed", "#888888"

# ---- clients (top left) ----
box(2, 134, 26, 13, "React Web Client", "field/crop UI, chat,\nphoto upload", fc=BLUE_FILL, ec=BLUE_EDGE)
box(31, 134, 26, 13, "Expo Mobile Client", "Android / iOS\ncamera capture", fc=BLUE_FILL, ec=BLUE_EDGE)

# ---- external data sources (top right, dashed container) ----
ax.add_patch(FancyBboxPatch((66, 130), 52, 19, boxstyle="round,pad=0.3,rounding_size=1.6",
                             fc="#fffaf0", ec=YEL_EDGE, lw=1.1, ls="--"))
ax.text(92, 146.3, "External Data Sources", fontsize=8.6, fontweight="bold", color="#8a6a1a", ha="center")
box(68, 132, 23, 12, "Open-Meteo +\nNASA POWER", "weather, radiation", fc=YEL_FILL, ec=YEL_EDGE, fs=7.6)
box(93, 132, 23, 12, "ISRIC SoilGrids", "soil water", fc=YEL_FILL, ec=YEL_EDGE, fs=7.6)

# ---- backend container ----
ax.add_patch(FancyBboxPatch((2, 86), 86, 38, boxstyle="round,pad=0.3,rounding_size=1.8",
                             fc=PUR_FILL, ec=PUR_EDGE, lw=1.3))
ax.text(45, 119.8, "Node.js / Express Backend", fontsize=10, fontweight="bold", color="#3d3570", ha="center")
ax.text(45, 116.6, "Owns the crop digital twin and business logic", fontsize=7.2, color="#564e94", ha="center", style="italic")

box(5, 101, 22, 12, "Phenology +\nPaddy Water Model", "GDD, ponded-depth", fc="#ffffff", ec=PUR_EDGE, fs=7.4)
box(29, 101, 22, 12, "Observation\nCorrection", "x' = x + c(x_obs - x)", fc="#ffffff", ec=PUR_EDGE, fs=7.4)
box(53, 101, 20, 12, "Fused\nCrop State", "health, confidence", fc=GRN_FILL, ec=GRN_EDGE, fs=7.4)

box(5, 88, 18, 11, "Recommendations", "irrigation, fertilizer", fc=PNK_FILL, ec=PNK_EDGE, fs=7.0)
box(25, 88, 22, 11, "Confidence &\nTreatment Gate", "withhold below 0.65", fc=PNK_FILL, ec=PNK_EDGE, fs=7.0)
box(49, 88, 22, 11, "Chat Proxy", "forwards farmer JWT\nto AI service", fc=PNK_FILL, ec=PNK_EDGE, fs=7.0)

# Sentinel-1, outside the backend, correcting into Observation Correction (not Fused Crop State directly)
box(92, 95, 26, 20, "Copernicus\nSentinel-1 SAR", "VH backscatter\n(flooding / transplant\nsignature)", fc=YEL_FILL, ec=YEL_EDGE, fs=7.4)

# ---- AI service container ----
ax.add_patch(FancyBboxPatch((14, 32), 74, 42, boxstyle="round,pad=0.3,rounding_size=1.8",
                             fc=ORG_FILL, ec=ORG_EDGE, lw=1.3))
ax.text(51, 69.0, "Python / FastAPI AI Service", fontsize=10, fontweight="bold", color="#8a4712", ha="center")
ax.text(51, 65.8, "Internal only (via shared service token)", fontsize=7.2, color="#a85f1e", ha="center", style="italic")
box(17, 48, 32, 14, "EfficientNet-B0\nClassifier", "10 rice-disease classes\n+ Grad-CAM++ heatmap", fc="#ffffff", ec=ORG_EDGE, fs=7.6)
box(53, 48, 32, 14, "LangGraph\nChat Agent", "tool-grounded\nReAct loop", fc="#ffffff", ec=ORG_EDGE, fs=7.6)
box(17, 35, 68, 10, "OpenAI API (chat completion)", "language layer only - never a source of a fertilizer,\nirrigation or treatment number", fc="#ffffff", ec=ORG_EDGE, fs=7.2)

# ---- storage (bottom) ----
box(2, 2, 32, 15, "Cloudflare R2 (S3)", "leaf photos +\nGrad-CAM overlays", fc=GRY_FILL, ec=GRY_EDGE, fs=7.8)
box(37, 2, 42, 15, "Supabase Postgres", "fields, crops, crop_states,\ncheck-ins, images - row-level security", fc=GRY_FILL, ec=GRY_EDGE, fs=7.8)

# ---- legend (bottom right) ----
ax.add_patch(FancyBboxPatch((82, 2), 36, 23, boxstyle="round,pad=0.3,rounding_size=1.2",
                             fc="white", ec="#999", lw=1.0, ls="--"))
ax.text(100, 22.3, "Legend", fontsize=8.2, fontweight="bold", ha="center")
arr((84, 17.5), (90, 17.5), c="#222"); ax.text(91, 17.5, "Main flow", fontsize=6.8, va="center")
arr((84, 12.5), (90, 12.5), c=ORG_EDGE, ls="--"); ax.text(91, 12.5, "External data / AI call", fontsize=6.8, va="center")
arr((84, 7.5), (90, 7.5), c=BLUE_EDGE, ls="--"); ax.text(91, 7.5, "Service token flow", fontsize=6.8, va="center")
arr((84, 3.2), (90, 3.2), c=ORG_EDGE, ls=":"); ax.text(91, 3.2, "Agent tool call (farmer JWT)", fontsize=6.4, va="center")

# ---- arrows: main flow ----
# clients -> backend
arr((15, 134), (20, 124.3), c="#222"); ax.text(17.3, 128.5, "HTTPS + JWT", fontsize=6.6, ha="center",
    rotation=0, color="#333", bbox=dict(fc="white", ec="none", pad=0.5))
arr((44, 134), (34, 124.3), c="#222")
# external data -> backend (weather/soil API calls)
arr((79, 130), (35, 113), rad=0.12, c=YEL_EDGE, ls="--", lw=1.1)
ax.text(66, 123, "API calls\n(weather/soil data)", fontsize=6.6, color="#8a6a1a", ha="center")
# Sentinel-1 -> Observation Correction (fix: correction path, not straight into Fused Crop State)
arr((92, 108), (51, 108.5), c=ORG_EDGE, ls="--", lw=1.2)
ax.text(76, 110.5, "SAR data", fontsize=6.6, color="#a85f1e", ha="center")
# backend internal flow
arr((27, 107), (29, 107)); arr((51, 107), (53, 107))
arr((16, 101), (16, 94)); arr((35, 101), (35, 94)); arr((62, 101), (62, 94))
# backend -> AI service (service token, request)
arr((41, 88), (41, 74), c=BLUE_EDGE, lw=1.6)
ax.text(29, 80, "1. service token:\nphoto + crop context", fontsize=6.8, color="#1c4a80", ha="center")
# AI service -> backend Confidence & Treatment Gate (fix: response targets the gate, not Chat Proxy)
arr((63, 74), (63, 88), c=ORG_EDGE, ls="--", lw=1.6)
ax.text(77, 80, "2. disease + confidence +\nGrad-CAM++ heatmap", fontsize=6.8, color="#a85f1e", ha="center")
# Confidence & Treatment Gate -> storage (fix: images/results stored from the disease pathway, not Recommendations)
arr((33, 88), (18, 17), rad=-0.12, c="#222", lw=1.3)
arr((36, 88), (55, 17), rad=0.12, c="#222", lw=1.3)
ax.text(10, 60, "3. store images\nand results", fontsize=6.8, color="#333", ha="left")
# agent tool calls go back to the BACKEND, using the farmer's own JWT - never straight to Postgres
arr((69, 48), (36, 88), rad=0.2, c=ORG_EDGE, ls=":", lw=1.3)
ax.text(85, 44, "4. tool calls read/write\ncrop state via the backend,\nusing the farmer's own JWT\n(never a direct DB link)", fontsize=6.6, color="#a85f1e", ha="left")
# OpenAI called only by the agent
arr((69, 48), (45, 45), c=ORG_EDGE, ls=":", lw=1.1)

fig.tight_layout()
fig.savefig(FIG / "arch.png")
plt.close(fig)

# =====================================================================
# Fig 2: disease-diagnosis data-flow (sequence diagram)
# =====================================================================
fig, ax = plt.subplots(figsize=(6.6, 4.8)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
lanes = [("Farmer\n(client)", 8, B), ("Express\nbackend", 32, "#6a5fc1"), ("R2 / S3\nstorage", 56, "#888"),
         ("FastAPI\nAI service", 76, "#c9691a"), ("Supabase\nPostgres", 94, "#888")]
for name, x, c in lanes:
    ax.plot([x, x], [6, 96], color=c, lw=1.1, alpha=0.5)
    ax.add_patch(FancyBboxPatch((x - 9, 92), 18, 7, boxstyle="round,pad=0.3,rounding_size=1", fc="white", ec=c, lw=1.2))
    ax.text(x, 95.5, name, ha="center", va="center", fontsize=7.2, fontweight="bold", color=c)

steps = [
    (8, 32, 86, "1. POST /crops/:id/diagnose\n(photo + taken_on + client_request_id)", B),
    (32, 56, 79, "2. store compressed JPEG", "#6a5fc1"),
    (32, 76, 72, "3. POST /detect-disease?heatmap=true\n(service token, decoded image)", "#6a5fc1"),
    (76, 76, 61, "4. EfficientNet-B0 forward pass\n+ Grad-CAM++ backward pass", "#c9691a"),
    (76, 32, 54, "5. {disease, confidence, margin,\nprobabilities, heatmap_b64}", "#c9691a"),
    (32, 32, 47, "6. confidence-gate check (0.65)\n+ treatment lookup (if gated open)", "#6a5fc1"),
    (32, 32, 40, "7. compare with twin's simulated\nhealth score -> twin_correction", "#6a5fc1"),
    (32, 94, 33, "8. write crop_images row\n(diagnosis, correction, taken_on)", "#6a5fc1"),
    (32, 8, 24, "9. diagnosis + heatmap (data URI)\n+ treatment (English, non-chemical\nif unreviewed) + before/after health", B),
]

def seq_arrow(x0, x1, y, label, color):
    ax.add_patch(FancyArrowPatch((x0, y), (x1, y), arrowstyle="-|>", mutation_scale=9, lw=1.2, color=color))
    mid = (x0 + x1) / 2
    va = "bottom"
    ax.text(mid, y + 1.0, label, ha="center", va=va, fontsize=6.3, color="#222")

for x0, x1, y, label, color in steps:
    seq_arrow(x0, x1, y, label, color)

ax.text(50, 2, "Every treatment field is populated only if confidence ≥ 0.65; below the gate the\n"
               "response carries the diagnosis and heatmap but no treatment instruction.",
        ha="center", fontsize=6.6, color=R, style="italic")
fig.tight_layout()
fig.savefig(FIG / "dataflow.png")
plt.close(fig)

# =====================================================================
# Fig 3: rice ponded depth, three points, no-irrigation vs refill overlay
# =====================================================================
d = load("e3_seasons.json")
get = lambda pid: next(x for x in d if x["point"]["id"] == pid and x["season"]["crop"] == "rice")
fig, ax = plt.subplots(2, 1, figsize=(6.4, 3.9), sharex=True, gridspec_kw={"height_ratios": [1, 1.2]})
for pid, c in (("P1", B), ("P2", G), ("P3", O)):
    r = get(pid)
    ax[0].bar([t["day"] for t in r["timeline"]], [t["rain"] for t in r["timeline"]], color=c, alpha=.35, width=1)
ax[0].set_ylabel("Rain (mm/day)")
ax[0].set_title("Rainfall at three Gorakhpur points; ponded depth with no irrigation", loc="left")
for pid, c in (("P1", B), ("P2", G), ("P3", O)):
    r = get(pid)
    ax[1].plot([t["day"] for t in r["timeline"]], [t["pond"] for t in r["timeline"]], color=c, lw=1.1, label=pid)
ax[1].axhline(50, color=K, ls="--", lw=.8)
ax[1].text(139, 56, "target 50 mm", va="bottom", ha="right", fontsize=7, color=K)
ax[1].axhline(0, color=R, lw=.6)
ax[1].set_ylabel("Ponded depth (mm)"); ax[1].set_xlabel("Days after transplanting (1 Jul 2025)")
ax[1].legend(frameon=False, ncol=3, fontsize=8)
fig.tight_layout(); fig.savefig(FIG / "rice_pond.png"); plt.close(fig)

# =====================================================================
# Fig 4: ETo cross-check, rice only
# =====================================================================
fig, ax = plt.subplots(figsize=(4.2, 3.4))
for pid, c in (("P1", B), ("P2", G), ("P3", O)):
    p = np.array([[q["ours"], q["om"]] for q in get(pid)["eto_pairs"]])
    ax.scatter(p[:, 1], p[:, 0], s=6, color=c, alpha=.55, label=pid, linewidths=0)
ax.plot([0, 9], [0, 9], color=K, lw=.8, ls="--")
ax.set_title("Rice season (Jul–Nov 2025)"); ax.set_xlabel("Open-Meteo ET0 (mm/day)"); ax.set_ylabel("FarmSense ETo (mm/day)")
ax.legend(frameon=False, fontsize=7.5, markerscale=2)
fig.tight_layout(); fig.savefig(FIG / "eto.png"); plt.close(fig)

# =====================================================================
# Fig 5: farmer check-in correction, rice (noise sweep)
# =====================================================================
e4br = load("e4b_rice.json")
fig, ax = plt.subplots(1, 2, figsize=(6.4, 3.0))
names = {
    "A no logs, no check-ins": ("A: no logs, no check-ins", K, "--"),
    "B 50% logged, no check-ins": ("B: 50% logged", B, "-"),
    "D 50% logged + check-in /7 d": ("D: 50% logged + weekly check-in", G, "-"),
    "F no logs + check-in /7 d": ("F: no logs + weekly check-in", O, "-"),
}
for k, (lab, c, ls) in names.items():
    xs = [x for x in e4br if x["cond"] == k]
    ax[0].plot([100 * x["noise"] for x in xs], [x["rmse"] for x in xs], color=c, ls=ls, marker="o", ms=3.5, lw=1.3, label=lab)
    ax[1].plot([100 * x["noise"] for x in xs], [100 * x["agree"] for x in xs], color=c, ls=ls, marker="o", ms=3.5, lw=1.3)
ax[0].set_ylabel("Ponded-depth RMSE (mm)"); ax[1].set_ylabel("Flooded-state agreement (%)")
for a in ax: a.set_xlabel("Farmer answer error rate (%)")
ax[0].legend(frameon=False, fontsize=6.6, loc="upper left")
fig.tight_layout(); fig.savefig(FIG / "correction.png"); plt.close(fig)

# =====================================================================
# Fig 6: ponding-management consistency (refill policy) + Sentinel-1
# =====================================================================
e3d = load("e3d.json")
sat = load("sat_summary.json")
fig, ax = plt.subplots(1, 2, figsize=(6.6, 3.0))
pts = [x["point"] for x in e3d]
w = 0.32
ax[0].bar(np.arange(3) - w/2, [x["none"]["unfloodedDays"] for x in e3d], w, color=R, label="No irrigation")
ax[0].bar(np.arange(3) + w/2, [x["refill"]["events"] for x in e3d], w, color=G, label="Refill-policy events")
ax[0].set_xticks(range(3)); ax[0].set_xticklabels(pts)
ax[0].set_ylabel("Count"); ax[0].set_title("Unflooded days (no irr.) vs.\nrefill irrigation events", fontsize=8.2)
ax[0].legend(frameon=False, fontsize=7)
for i, x in enumerate(e3d):
    ax[0].text(i + w/2, x["refill"]["events"] + 0.6, f"{x['refill']['applied']}mm", ha="center", fontsize=6.6, color=G)

pal = [B, G]
for i, p in enumerate(sat["points"]):
    s1 = load("e5.json")[i]["s1"]
    s1 = sorted(s1, key=lambda o: o["date"])
    dt = np.array([np.datetime64(o["date"]) for o in s1]); vh = np.array([o["vhDb"] for o in s1])
    ax[1].plot(dt, vh, marker="o", ms=3, lw=1.1, color=pal[i], label=f"({p['lat']}°N, {p['lon']}°E)")
ax[1].axhline(-22, color=R, ls="--", lw=.9)
ax[1].text(np.datetime64("2025-06-03"), -21.4, "open-water threshold −22 dB", fontsize=6.6, color=R, va="bottom")
ax[1].set_ylabel("Field-mean VH (dB)"); ax[1].set_title("Sentinel-1 VH backscatter,\nJun–Sep 2025", fontsize=8.2)
ax[1].legend(frameon=False, fontsize=6.6, loc="lower right")
ax[1].xaxis.set_major_formatter(md.DateFormatter("%b")); ax[1].xaxis.set_major_locator(md.MonthLocator())
fig.tight_layout(); fig.savefig(FIG / "ponding_sat.png"); plt.close(fig)

# =====================================================================
# Fig 7: disease classifier evaluation (confusion matrix + per-class F1 + calibration)
# =====================================================================
metrics = json.loads(Path("/Users/baijuyadav/Desktop/FarmSense/ai/models/rice_v2/metrics.json").read_text())
classes = metrics["classes"]
cm = np.array(metrics["in_distribution_val"]["confusion"])
cmn = cm / cm.sum(axis=1, keepdims=True)

fig, ax = plt.subplots(1, 3, figsize=(10.2, 3.4), gridspec_kw={"width_ratios": [1.3, 1, 1]})
im = ax[0].imshow(cmn, cmap="Greens", vmin=0, vmax=1)
short = [c.replace("_", " ") for c in classes]
ax[0].set_xticks(range(len(classes))); ax[0].set_xticklabels(short, rotation=90, fontsize=6)
ax[0].set_yticks(range(len(classes))); ax[0].set_yticklabels(short, fontsize=6)
for i in range(len(classes)):
    for j in range(len(classes)):
        if cm[i, j] > 0:
            ax[0].text(j, i, str(cm[i, j]), ha="center", va="center", fontsize=5.2,
                       color="white" if cmn[i, j] > 0.5 else "#222")
ax[0].set_title("In-distribution validation\nconfusion matrix (n=1496)", fontsize=8)
ax[0].set_xlabel("Predicted"); ax[0].set_ylabel("True")

f1s = [metrics["in_distribution_val"]["per_class"][c]["f1"] for c in classes]
supports = [metrics["in_distribution_val"]["per_class"][c]["support"] for c in classes]
ax[1].barh(range(len(classes)), f1s, color=G)
ax[1].set_yticks(range(len(classes))); ax[1].set_yticklabels(short, fontsize=6.4); ax[1].invert_yaxis()
ax[1].set_xlim(0, 1.05); ax[1].set_xlabel("F1 score"); ax[1].set_title("Per-class F1\n(in-distribution val.)", fontsize=8)
for i, (f, s) in enumerate(zip(f1s, supports)):
    ax[1].text(f + 0.02, i, f"n={s}", va="center", fontsize=5.6, color="#444")

val_acc, test_acc = metrics["in_distribution_val"]["accuracy"], metrics["heldout_test"]["accuracy"]
val_ece, test_ece = metrics["in_distribution_val"]["ece"], metrics["heldout_test"]["ece"]
bars = ax[2].bar(["in-dist.\nval.", "held-out\n(cross-dataset)"], [val_acc, test_acc], color=[G, R], width=0.55)
ax[2].set_ylim(0, 1.0); ax[2].set_ylabel("Accuracy")
ax[2].set_title("In-distribution vs.\ncross-dataset accuracy", fontsize=8)
for b, acc, ece in zip(bars, [val_acc, test_acc], [val_ece, test_ece]):
    ax[2].text(b.get_x() + b.get_width()/2, acc + 0.02, f"{acc:.0%}\nECE {ece:.2f}", ha="center", fontsize=6.6)
fig.tight_layout(); fig.savefig(FIG / "disease_eval.png"); plt.close(fig)

# =====================================================================
# Fig 8: OOD gate (old ResNet-18/4-class vs new EfficientNet-B0/10-class)
# =====================================================================
e6_old = load("e6.json"); e6_new = load("e6_v2.json")
gates = [0.5, 0.65, 0.8, 0.9, 0.95, 0.99]
conf_old = [r["confidence"] for v in e6_old["ood"].values() for r in v]
conf_new = [r["confidence"] for v in e6_new["ood"].values() for r in v]
fig, ax = plt.subplots(1, 2, figsize=(6.6, 2.9))
ax[0].plot(gates, [100*np.mean([c >= g for c in conf_old]) for g in gates], marker="o", color=R, lw=1.4, label="4-class ResNet-18 (v1)")
ax[0].plot(gates, [100*np.mean([c >= g for c in conf_new]) for g in gates], marker="s", color=G, lw=1.4, label="10-class EfficientNet-B0 (v2, shipped)")
ax[0].axvline(0.65, color=K, ls="--", lw=.8); ax[0].text(0.655, 8, "deployed\ngate 0.65", fontsize=6.6, color=K)
ax[0].set_xlabel("Confidence gate"); ax[0].set_ylabel("Non-leaf images\naccepted (%)"); ax[0].set_ylim(0, 100)
ax[0].legend(frameon=False, fontsize=6.6, loc="upper right")
labs = {"solid_colour": "Solid colour", "gaussian_noise": "Gaussian noise", "gradient": "Gradient", "stripes": "Stripes", "green_texture": "Green texture"}
ks = list(labs)
v_old = [100*np.mean([r["confidence"] >= 0.65 for r in e6_old["ood"][k]]) for k in ks]
v_new = [100*np.mean([r["confidence"] >= 0.65 for r in e6_new["ood"][k]]) for k in ks]
y = np.arange(len(ks))
ax[1].barh(y - 0.2, v_old, height=0.38, color=R, alpha=.85, label="v1")
ax[1].barh(y + 0.2, v_new, height=0.38, color=G, alpha=.85, label="v2")
ax[1].set_yticks(y); ax[1].set_yticklabels([labs[k] for k in ks], fontsize=7.5); ax[1].invert_yaxis()
ax[1].set_xlim(0, 100); ax[1].set_xlabel("Accepted at gate 0.65 (%)")
fig.tight_layout(); fig.savefig(FIG / "ood.png"); plt.close(fig)

# =====================================================================
# Fig 9: case study - 5 real field photos, original | Grad-CAM++ overlay
# =====================================================================
case = load("case_study.json")
figdir = RES / "case_study_fig"
fig, axs = plt.subplots(2, 5, figsize=(10.5, 4.6))
for i, c in enumerate(case):
    stem = c["file"].rsplit(".", 1)[0]
    orig = Image.open(figdir / f"{stem}_original.jpg")
    cam = Image.open(figdir / f"{stem}_cam.jpg")
    axs[0, i].imshow(orig); axs[1, i].imshow(cam)
    gate_ok = c["confidence"] >= 0.65
    title_color = G if gate_ok else R
    axs[0, i].set_title(f"{c['disease'].replace('_', ' ')}\n{c['confidence']:.0%}" + ("" if gate_ok else "  (below gate)"),
                         fontsize=7.4, color=title_color)
    for r in range(2):
        axs[r, i].axis("off")
axs[0, 0].text(-0.15, 0.5, "photo", transform=axs[0, 0].transAxes, rotation=90, va="center", ha="center", fontsize=8)
axs[1, 0].text(-0.15, 0.5, "Grad-CAM++", transform=axs[1, 0].transAxes, rotation=90, va="center", ha="center", fontsize=8)
fig.tight_layout(); fig.savefig(FIG / "case_study.png"); plt.close(fig)

print("All figures written to", FIG)
for f in sorted(FIG.glob("*.png")):
    print(" ", f.name)
