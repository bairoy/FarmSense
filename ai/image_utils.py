"""Image normalisation shared by the inference path and the storage path.

Two separate jobs, deliberately kept apart:

  * `compress_for_storage` produces the artefact we keep forever in R2. It is
    lossy and much smaller than the phone original (typically 20-30x), but
    still large enough for a human agronomist to look at later.
  * The model transform (in disease_model.py) produces the 224x224 tensor.

We never store the 224x224 version: it is useless to a human and useless for
retraining at a higher input resolution later.
"""

import io

from PIL import Image, ImageOps

from config import JPEG_QUALITY, MAX_IMAGE_EDGE_PX


def load_image(raw: bytes) -> Image.Image:
    """Decode bytes to RGB, honouring EXIF orientation.

    Phone cameras record rotation in EXIF rather than rotating the pixels. If
    we skip `exif_transpose`, a portrait photo reaches the model sideways and
    accuracy quietly degrades on exactly the images farmers actually take.
    """
    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def compress_for_storage(image: Image.Image) -> bytes:
    """Downscale to MAX_IMAGE_EDGE_PX on the longest edge and JPEG-encode."""
    work = image.copy()
    work.thumbnail((MAX_IMAGE_EDGE_PX, MAX_IMAGE_EDGE_PX), Image.LANCZOS)

    buffer = io.BytesIO()
    work.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buffer.getvalue()
