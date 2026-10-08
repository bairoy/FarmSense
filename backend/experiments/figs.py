import json, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.spines.top":False,"axes.spines.right":False,"axes.titlesize":9.5,"axes.titleweight":"bold","figure.dpi":200,"savefig.dpi":200})
G,B,O,R,K,Y = "#2f7d4f","#2b6cb0","#c9691a","#b83232","#555555","#8a6d00"
d = json.load(open("e3_seasons.json")); e3b=json.load(open("e3b.json")); e3c=json.load(open("e3c.json")); e4b=json.load(open("e4b.json")); e6=json.load(open("e6.json"))
get = lambda pid,crop: next(x for x in d if x["point"]["id"]==pid and x["season"]["crop"]==crop)

# ---- Fig 2: wheat depletion ----
w = get("P2","wheat"); tl=w["timeline"]; day=[t["day"] for t in tl]
fig,ax = plt.subplots(2,1,figsize=(6.4,4.6),sharex=True,gridspec_kw={"height_ratios":[1,1.3]})
ax[0].plot(day,[t["eto"] for t in tl],color=B,lw=1,label="ETo (Penman–Monteith)")
ax[0].plot(day,[t["etc"] for t in tl],color=G,lw=1.2,label="ETc = Kc × ETo")
ax0b=ax[0].twinx(); ax0b.bar(day,[t["rain"] for t in tl],color="#9bb7d4",width=1,label="Rainfall"); ax0b.set_ylabel("Rain (mm/day)"); ax0b.spines["top"].set_visible(False)
ax[0].set_ylabel("mm/day"); ax[0].legend(loc="upper left",frameon=False,fontsize=7.5)
ax[1].plot(day,[t["dep"] for t in tl],color=O,lw=1.4,label="Root-zone depletion Dr (no irrigation)")
ax[1].plot(day,[t["raw"] for t in tl],color=Y,lw=1,ls="--",label="RAW (stress onset)")
ax[1].plot(day,[t["taw"] for t in tl],color=R,lw=1,ls=":",label="TAW (wilting point)")
mad=next(x for x in e3b if x["point"]=="P2")["mad"]["events"]
for i,e in enumerate(mad): ax[1].axvline(e,color=G,lw=1.4,label="Model-triggered irrigation" if i==0 else None)
for i,e in enumerate([21,45,65,85,105,120]): ax[1].axvline(e,color=K,lw=0.6,ls="-.",alpha=.6,label="ICAR critical-stage calendar" if i==0 else None)
ax[1].set_ylabel("Depletion (mm)"); ax[1].set_xlabel("Days after sowing (sown 15 Nov 2025, Gorakhpur district, P2)"); ax[1].legend(loc="upper left",frameon=False,fontsize=7.2)
fig.tight_layout(); fig.savefig("fig/wheat.png"); plt.close(fig)

# ---- Fig 3: rice ponded depth ----
fig,ax=plt.subplots(2,1,figsize=(6.4,3.8),sharex=True,gridspec_kw={"height_ratios":[1,1.2]})
for pid,c in (("P1",B),("P2",G),("P3",O)):
    r=get(pid,"rice"); ax[0].bar([t["day"] for t in r["timeline"]],[t["rain"] for t in r["timeline"]],color=c,alpha=.35,width=1)
ax[0].set_ylabel("Rain (mm/day)")
ax[0].set_title("Rainfall at three district points; ponded depth with no irrigation",loc="left")
for pid,c in (("P1",B),("P2",G),("P3",O)):
    r=get(pid,"rice"); ax[1].plot([t["day"] for t in r["timeline"]],[t["pond"] for t in r["timeline"]],color=c,lw=1.1,label=f"{pid}")
ax[1].axhline(50,color=K,ls="--",lw=.8); ax[1].text(139,56,"target 50 mm",va="bottom",ha="right",fontsize=7,color=K)
ax[1].axhline(0,color=R,lw=.6); ax[1].set_ylabel("Ponded depth (mm)"); ax[1].set_xlabel("Days after transplanting (1 Jul 2025)"); ax[1].legend(frameon=False,ncol=3,fontsize=8)
fig.tight_layout(); fig.savefig("fig/rice.png"); plt.close(fig)

# ---- Fig 4: ETo cross-check ----
fig,ax=plt.subplots(1,2,figsize=(6.4,3.0),sharex=True,sharey=True)
for a,crop,title in ((ax[0],"rice","Rice season (Jul–Nov 2025)"),(ax[1],"wheat","Wheat season (Nov 2025–Apr 2026)")):
    for pid,c in (("P1",B),("P2",G),("P3",O)):
        p=np.array([[q["ours"],q["om"]] for q in get(pid,crop)["eto_pairs"]]); a.scatter(p[:,1],p[:,0],s=5,color=c,alpha=.55,label=pid,linewidths=0)
    a.plot([0,9],[0,9],color=K,lw=.8,ls="--"); a.set_title(title); a.set_xlabel("Open-Meteo ET0 (mm/day)")
ax[0].set_ylabel("FarmSense ETo (mm/day)"); ax[0].legend(frameon=False,fontsize=7.5,markerscale=2)
fig.tight_layout(); fig.savefig("fig/eto.png"); plt.close(fig)

# ---- Fig 5: correction noise sweep ----
fig,ax=plt.subplots(1,2,figsize=(6.4,3.0))
names={"A no logs, no check-ins":("A: no logs, no check-ins",K,"--"),"B 50% logged, no check-ins":("B: 50% logged",B,"-"),"D 50% logged + check-in /7 d":("D: 50% logged + weekly check-in",G,"-"),"F no logs + check-in /7 d":("F: no logs + weekly check-in",O,"-")}
for k,(lab,c,ls) in names.items():
    xs=[x for x in e4b if x["cond"]==k]; ax[0].plot([100*x["noise"] for x in xs],[x["rmse"] for x in xs],color=c,ls=ls,marker="o",ms=3.5,lw=1.3,label=lab)
    ax[1].plot([100*x["noise"] for x in xs],[100*x["agree"] for x in xs],color=c,ls=ls,marker="o",ms=3.5,lw=1.3)
ax[0].set_ylabel("Depletion RMSE (mm)"); ax[1].set_ylabel("Stress-state agreement (%)")
for a in ax: a.set_xlabel("Farmer answer error rate (%)")
ax[0].legend(frameon=False,fontsize=6.8,loc="center left",bbox_to_anchor=(0.0,0.62)); ax[0].set_ylim(25,110); fig.tight_layout(); fig.savefig("fig/noise.png"); plt.close(fig)

# ---- Fig 6: root depth sensitivity ----
fig,ax=plt.subplots(figsize=(6.0,2.9))
zs=[0.6,0.9,1.2,1.5]; w=0.22
for j,(pid,c) in enumerate((("P1",B),("P2",G),("P3",O))):
    ax.bar(np.arange(4)+(j-1)*w,[len(next(x for x in e3c if x["zmax"]==z and x["point"]==pid)["events"]) for z in zs],w,color=c,label=pid)
ax.axhline(6,color=K,ls="--",lw=.9); ax.text(-0.45,6.12,"ICAR calendar: 6 irrigations",ha="left",fontsize=7.5,color=K)
ax.set_xticks(range(4)); ax.set_xticklabels([f"{z} m" for z in zs]); ax.set_xlabel("Assumed maximum effective root-zone depth"); ax.set_ylabel("Irrigations triggered\nper wheat season"); ax.legend(frameon=False,ncol=3,fontsize=8,loc="upper right",bbox_to_anchor=(1.0,0.86)); ax.set_ylim(0,7)
fig.tight_layout(); fig.savefig("fig/rootdepth.png"); plt.close(fig)

# ---- Fig 7: OOD gate ----
allc=[r["confidence"] for v in e6["ood"].values() for r in v]
gates=[0.5,0.65,0.8,0.9,0.95,0.99]
fig,ax=plt.subplots(1,2,figsize=(6.4,2.9))
ax[0].plot(gates,[100*np.mean([c>=g for c in allc]) for g in gates],marker="o",color=R,lw=1.4)
ax[0].axvline(0.65,color=K,ls="--",lw=.8); ax[0].text(0.655,8,"deployed\ngate 0.65",fontsize=7,color=K)
ax[0].set_xlabel("Confidence gate"); ax[0].set_ylabel("Out-of-distribution inputs\naccepted (%)"); ax[0].set_ylim(0,100)
labs={"solid_colour":"Solid colour","gaussian_noise":"Gaussian noise","gradient":"Gradient","stripes":"Stripes","green_texture":"Green texture"}
ks=list(labs); vals=[100*np.mean([r["confidence"]>=0.65 for r in e6["ood"][k]]) for k in ks]
ax[1].barh(range(len(ks)),vals,color=R,alpha=.85); ax[1].set_yticks(range(len(ks))); ax[1].set_yticklabels([labs[k] for k in ks],fontsize=8); ax[1].invert_yaxis()
ax[1].set_xlim(0,100); ax[1].set_xlabel("Accepted at gate 0.65 (%)")
fig.tight_layout(); fig.savefig("fig/ood.png"); plt.close(fig)

# ---- Fig 1: architecture ----
fig,ax=plt.subplots(figsize=(6.6,4.6)); ax.set_xlim(0,100); ax.set_ylim(0,72); ax.axis("off")
def box(x,y,w,h,t,sub=None,fc="#eef2ee",ec="#8aa08a",bold=True,fs=8.2):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.4,rounding_size=1.2",fc=fc,ec=ec,lw=1.1))
    ax.text(x+w/2,y+h/2+(1.8 if sub else 0),t,ha="center",va="center",fontsize=fs,fontweight="bold" if bold else "normal",color="#1a1a1a")
    if sub: ax.text(x+w/2,y+h/2-2.4,sub,ha="center",va="center",fontsize=6.6,color="#444")
def arr(a,b,c="#444",st="-|>",ls="-",rad=0):
    ax.add_patch(FancyArrowPatch(a,b,arrowstyle=st,mutation_scale=9,lw=1,color=c,ls=ls,connectionstyle=f"arc3,rad={rad}"))
box(3,58,21,10,"Weather","Open-Meteo, NASA POWER"); box(30,58,21,10,"Soil","ISRIC SoilGrids (TAW)"); box(57,58,21,10,"Satellite","Sentinel-1 SAR, Sentinel-2")
ax.add_patch(FancyBboxPatch((2,22),80,32,boxstyle="round,pad=0.3,rounding_size=1.5",fc="#f1f0fa",ec="#9a94d8",lw=1.1)); ax.text(4,51.2,"Crop digital twin (per field, per day)",fontsize=8,fontweight="bold",color="#3d3a8a")
box(5,36,22,11,"Phenology","GDD thermal time"); box(31,36,24,11,"Water balance","FAO-56 paddy / depletion"); 
box(20,24.5,42,8,"Fused crop state","health · water status · phase · confidence",fc="#e2f1e8",ec="#2f7d4f")
box(86,42,12,10,"Farmer\ncheck-ins","",fc="#fff1e3",ec="#c9691a",fs=7.4); box(86,26,12,10,"Dated\nphoto","ResNet-18",fc="#fff1e3",ec="#c9691a",fs=7.4)
box(4,8,26,9,"Recommendations","irrigation · fertilizer",fc="#fbe9ef",ec="#b8577a"); box(36,8,22,9,"Chat agent","tool-grounded",fc="#fbe9ef",ec="#b8577a"); box(64,8,26,9,"Database (Supabase)","state history · RLS",fc="#eeeeee",ec="#888")
for x in (13,40): arr((x,58),(x,47.6))
arr((66,58),(58,32.6),c="#7a7a7a",ls="--")
arr((16,36),(30,32.7)); arr((43,36),(43,32.7))
arr((86,47),(62,29),c="#c9691a"); arr((86,31),(62,27),c="#c9691a")
arr((30,24.5),(17,17.6)); arr((41,24.5),(46,17.6)); arr((52,24.5),(75,17.6))
ax.text(70,50.5,"observation\ncorrection",fontsize=6.6,color="#c9691a",ha="center")
fig.tight_layout(); fig.savefig("fig/arch.png"); plt.close(fig)
print("ok")
