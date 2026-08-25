# FarmSense Learning Notes

Written to be read in order. Each note follows the same shape: **the problem**,
**the concept**, **the decision and why**, **the code**, and **what would break
if you got it wrong**.

The goal is that six months from now you can rebuild any part of this system
from these notes alone, and — more importantly — argue for why it is built this
way.

## The notes

| # | Note | What it covers |
|---|---|---|
| 01 | [FAO-56 & GDD: the first digital twin](01-fao56-gdd-digital-twin.md) | *(earlier note)* Why heuristics were replaced with thermal time and a soil water bucket |
| 03 | [Open-Meteo integration](03-open-meteo-integration.md) | *(earlier note)* Stitching the archive and forecast APIs |
| 04 | [Predict → Observe → Correct](04-predict-observe-correct.md) | The core architecture. Why an open-loop simulation is not a digital twin |
| 05 | [Penman-Monteith from scratch](05-penman-monteith-eto.md) | The physics of evaporative demand, and why we don't just use the API's number |
| 06 | [Two crops, two water models](06-rice-vs-wheat-water-models.md) | Why rice cannot be modelled as "wheat with different constants" |
| 07 | [Satellite grounding](07-satellite-grounding.md) | Sentinel-2 NDVI, Sentinel-1 SAR, and the V-shaped flooding signature |
| 08 | [Confidence as a safety control](08-confidence-as-output.md) | Why every number ships with its own staleness |
| 09 | [The image pipeline & R2](09-image-pipeline-r2.md) | Egress economics, compression, and storing keys not bytes |
| 10 | [Recommendations that can't lie](10-recommendation-engine.md) | Rate tables, land units, dosage vs timing, and the confidence gate |
| 11 | [Grounding the agent](11-agent-grounding.md) | Why the LLM is forbidden from producing a single agronomic number |
| 12 | [Testing physics](12-testing-a-physical-model.md) | How to unit-test a simulation when you have no ground truth |

## The one-paragraph version

FarmSense estimates what is happening inside a rice or wheat field in Gorakhpur,
Uttar Pradesh, without any sensors in that field. It does this by simulating the crop
from physics (weather → evaporative demand → soil water → stress), then
correcting that simulation whenever an independent observation arrives (a
satellite pass, a farmer's answer, a photo diagnosis). Every output carries how
much you should trust it. Every quantity a farmer might act on comes from a
published reference table or a physical model — never from a language model.
