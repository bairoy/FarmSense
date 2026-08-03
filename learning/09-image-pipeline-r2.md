# 09 — The image pipeline: egress economics and the missing write path

## The problem

Two separate failures, both invisible from the code:

**1. The result was thrown away.** `/detect-disease` classified an image and
returned JSON. Nothing wrote a row. The README promised "track health history
over time"; there was no code path from the classifier to any table. Disease
detection and the rule-based health score were two disconnected systems both
computing "health" and never speaking.

**2. There was no way to use it.** No `disease` feature folder existed in the
frontend at all. The flagship "AI-powered crop health" feature had a working
model, a backend endpoint, and zero way for a farmer to reach it.

Plus a storage problem waiting to happen: a photo-heavy farm app with no storage
strategy.

## The concept: egress, not storage, is the quota that bites

Compare the free tiers:

| | Storage | Egress |
|---|---|---|
| Supabase (free) | 1 GB files, 500 MB DB | **5 GB/month** |
| Cloudflare R2 (free) | 10 GB | **Zero. At any volume.** |

Now think about the access pattern. A farmer opens a crop's photo history. Ten
photos load. They open it again next week — **the same ten photos load again**.
Egress is charged on every view; storage is charged once.

At 300 KB per stored image and 10 images per crop, 200 crops is 600 MB stored
(fine on either) but a farmer checking history twice a week burns through 5 GB
of Supabase egress in about a month. **Egress is the wall you hit first, and R2
removes it entirely.**

And never `bytea` in Postgres: you'd burn the 500 MB database quota on binary
data that is never queried, only served.

## The decision

### Postgres stores the key. R2 stores the bytes.

```sql
alter table public.crop_images
  add column if not exists r2_key text,
  add column if not exists disease_class text,
  add column if not exists confidence numeric,
  add column if not exists treatment_recommended text,
  add column if not exists crop_state_id uuid references public.crop_states(id);
```

A few hundred bytes per row instead of megabytes.

### Compress once, at the point of decoding

The AI service decodes the image, and returns **both** the classification and the
compressed archival JPEG:

```python
image = load_image(raw)              # decode once
result = predict_disease(image)      # model sees these pixels
compressed = compress_for_storage(image)   # we archive these pixels
result["image_b64"] = base64.b64encode(compressed).decode("ascii")
```

Decoding once means **the bytes we archive are provably the same pixels the
model was shown**. If a diagnosis is later disputed, the stored image is the
actual evidence.

Not compressing in the browser, for the same reason — and because a phone on a
rural connection shouldn't be doing image processing before it can upload.

**EXIF orientation matters more than it looks:**

```python
image = ImageOps.exif_transpose(image)
```

Phone cameras record rotation in EXIF rather than rotating the pixels. Skip this
and a portrait photo reaches the model sideways — quietly degrading accuracy on
exactly the images farmers actually take.

Typical result: 4 MB → ~150 KB, a 25–30× reduction, at 1000px longest edge and
JPEG quality 75 — still large enough for a human agronomist to review later.

We never store the 224×224 model input: useless to a human, and useless for
retraining at higher resolution later.

### The write path that was missing

```
photo → classify → store in R2 → look up treatment (gated)
                                      ↓
                          write crop_states row  (source: 'disease_model')
                                      ↓
                          write crop_images row  (crop_state_id FK)
```

A disease observation is a **real, independent measurement of crop health** — the
same class of thing as a satellite pass. It belongs in `crop_states` with its
source labelled, so the fusion step can weight it properly.

The health score it contributes is **scaled by confidence**:

```ts
return Math.round(100 - (100 - floor) * prediction.confidence);
```

A hesitant "leaf_blast" shouldn't slam the score to 40. An uncertain observation
should move the estimate, not dominate it.

### Degrade, don't fail

```ts
if (isR2Configured()) {
  try { imageKey = await uploadImage(...); }
  catch (err) { console.error("R2 upload failed; keeping diagnosis without image:", err); }
}
```

Losing the photo is bad. Losing the **observation** is worse.

### Object keys and URLs

```ts
`crops/${yyyy}/${mm}/${cropInstanceId}/${randomUUID()}.jpg`
```

The date prefix isn't decoration — it makes lifecycle rules ("archive anything
older than one season") expressible as a prefix match. The UUID prevents
collisions and leaks nothing about the uploader.

Keys are stored, **URLs are resolved at read time**, because presigned URLs
expire and a baked-in URL would rot in the database.

```ts
CacheControl: "public, max-age=31536000, immutable"
```

Photos never change once written. Every browser cache hit is an R2 read
operation we don't spend from the 10M/month allowance.

## Security fixes along the way

The old handler did this:

```python
file_path = os.path.join(UPLOAD_DIR, file.filename)   # client-supplied name
with open(file_path, "wb") as buffer:
    shutil.copyfileobj(file.file, buffer)
```

Two problems: a **path-traversal foothold** via `file.filename`, and an unbounded
disk leak. Nothing touches the filesystem now.

And the endpoint had **no authentication at all**, while it happily ran
inference for anyone who found the URL. It now requires a shared service token,
and **fails closed**:

```python
if not AI_SERVICE_TOKEN:
    raise HTTPException(503, "AI_SERVICE_TOKEN is not configured; refusing requests.")
```

A misconfigured deploy should be obviously broken, not quietly wide open.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| Bytes in Postgres | 500 MB DB quota gone; backups become enormous. |
| Supabase Storage for a photo app | Egress quota exhausted by ordinary browsing. |
| Compress in the browser | Archived image ≠ classified image. Disputes unresolvable. |
| Skip EXIF transpose | Sideways images, silently lower accuracy. |
| No `crop_states` write | "Health history" remains a README promise. |
| Client filename as a path | Path traversal. |
| Unauthenticated inference endpoint | Free compute for whoever finds it. |
| Failing the whole request when R2 is down | You lose the diagnosis to save the photo. Backwards. |

## Code

- `ai/image_utils.py`, `ai/api.py`
- `backend/src/modules/images/r2.storage.ts`
- `backend/src/modules/disease/disease.service.ts`
- `farmsense-frontend/src/features/disease/pages/CropDiagnosis.tsx`
