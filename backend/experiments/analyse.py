import json, numpy as np
d = json.load(open("e3_seasons.json"))
out = {}
for x in d:
    tl = x["timeline"]; pid = x["point"]["id"]; crop = x["season"]["crop"]
    a = np.array([[p["ours"], p["om"]] for p in x["eto_pairs"]])
    diff = a[:,0]-a[:,1]
    r = float(np.corrcoef(a[:,0], a[:,1])[0,1])
    rec = dict(n=len(a), bias=float(diff.mean()), rmse=float(np.sqrt((diff**2).mean())), mae=float(np.abs(diff).mean()), r=r,
               mean_ours=float(a[:,0].mean()), mean_om=float(a[:,1].mean()),
               pm_days=sum(1 for p in x["eto_pairs"] if p["method"]=="penman_monteith"),
               tot_eto=float(sum(t["eto"] for t in tl)), tot_etc=float(sum(t["etc"] for t in tl)), tot_rain=float(sum(t["rain"] for t in tl)),
               gdd_end=tl[-1]["gdd"], soil=x["soil"]["source"], taw=x["soil"]["tawMmPerM"])
    # phase durations (first day of each phase)
    ph = {}
    for t in tl:
        ph.setdefault(t["phase"], t["day"])
    rec["phase_start_day"] = ph
    out[f"{pid}-{crop}"] = rec
json.dump(out, open("analysis.json","w"), indent=1)
for k,v in out.items():
    print(k, {kk: (round(vv,2) if isinstance(vv,float) else vv) for kk,vv in v.items() if kk!="phase_start_day"}, v["phase_start_day"])
