import json, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.spines.top":False,"axes.spines.right":False,"axes.titlesize":9.5,"axes.titleweight":"bold","figure.dpi":200,"savefig.dpi":200})
d = json.load(open("e5.json"))
pal = ["#2b6cb0", "#2f7d4f", "#c9691a", "#8a3ea8", "#b83232", "#555555"]
summ = {"points": []}
fig, ax = plt.subplots(1, 2, figsize=(6.6, 3.2), gridspec_kw={"width_ratios": [1.5, 1]})
for i, p in enumerate(d):
    s1 = sorted(p["s1"], key=lambda o: o["date"]); dt = np.array([np.datetime64(o["date"]) for o in s1]); vh = np.array([o["vhDb"] for o in s1])
    ax[0].plot(dt, vh, marker="o", ms=3, lw=1.1, color=pal[i % 6], label=f"({p['lat']}°N, {p['lon']}°E)")
    s2 = [x for x in p["s2"] if x and x.get("usable")]
    summ["points"].append(dict(lat=p["lat"], lon=p["lon"], s1_obs=len(s1), s1_windows=p["s1_windows"], vh_min=float(vh.min()), vh_max=float(vh.max()), vh_median=float(np.median(vh)),
        n_below22=int((vh < -22).sum()), detected=p["detection"]["detected"], date=p["detection"]["transplantDate"], conf=p["detection"]["confidence"], expl=p["detection"]["explanation"],
        s2_usable=len(s2), s2_windows=len(p["s2"]), s2_ndvi_max=(max(x["ndvi"] for x in s2) if s2 else None), s2_ndvi_min=(min(x["ndvi"] for x in s2) if s2 else None),
        s2_cloud_mean=float(np.mean([x["cloudFraction"] for x in p["s2"] if x and "cloudFraction" in x])) if any(x and "cloudFraction" in x for x in p["s2"]) else None))
ax[0].axhline(-22, color="#b83232", ls="--", lw=.9); ax[0].text(np.datetime64("2025-06-02"), -21.6, "open-water threshold −22 dB", fontsize=7, color="#b83232", va="bottom")
ax[0].set_ylabel("Field-mean VH backscatter (dB)"); ax[0].set_title("Sentinel-1 VH, Jun–Sep 2025"); ax[0].legend(frameon=False, fontsize=6.6, loc="lower right")
for lab in ax[0].get_xticklabels(): lab.set_rotation(30); lab.set_ha("right")
import matplotlib.dates as md
ax[0].xaxis.set_major_formatter(md.DateFormatter("%b")); ax[0].xaxis.set_major_locator(md.MonthLocator())
for lab in ax[0].get_xticklabels(): lab.set_rotation(0); lab.set_ha("center")
# S2: NDVI observations across points vs window date
for i, p in enumerate(d):
    xs, ys = [], []
    for x in p["s2"]:
        if x and x.get("usable"): xs.append(np.datetime64(x["date"])); ys.append(x["ndvi"])
    ax[1].plot(xs, ys, marker="o", ms=3, lw=1.1, color=pal[i % 6])
ax[1].set_ylabel("Field-mean NDVI"); ax[1].set_title("Sentinel-2 NDVI, Nov–Apr")
ax[1].xaxis.set_major_formatter(md.DateFormatter("%b")); ax[1].xaxis.set_major_locator(md.MonthLocator(interval=2)); ax[1].set_ylim(0, 1)
fig.tight_layout(); fig.savefig("fig/sat.png"); plt.close(fig)
json.dump(summ, open("sat_summary.json", "w"), indent=1)
for x in summ["points"]: print({k: (round(v, 2) if isinstance(v, float) else v) for k, v in x.items() if k != "expl"}); print("   ", x["expl"])
