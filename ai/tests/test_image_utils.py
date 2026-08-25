"""Image handling on the path between a farmer's phone and the classifier.

Nothing here needs the trained weights or the training set. These cover the
transformations that happen to every uploaded photo regardless of what the
model then says about it.
"""

import io

import pytest
from PIL import Image, UnidentifiedImageError

from config import JPEG_QUALITY, MAX_IMAGE_EDGE_PX
from image_utils import compress_for_storage, load_image


def encode(image: Image.Image, fmt: str = "JPEG") -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def test_load_image_returns_rgb():
    # Phone uploads arrive in whatever mode the encoder chose. The model's
    # first conv layer takes 3 channels, so a greyscale or palette image has to
    # be widened before it ever reaches the transform.
    for mode in ("L", "P", "RGBA", "RGB"):
        raw = encode(Image.new(mode, (32, 32)), fmt="PNG")
        assert load_image(raw).mode == "RGB", f"{mode} should load as RGB"


def test_load_image_rejects_non_image_bytes():
    # An upload that is not an image at all must fail loudly here rather than
    # somewhere deeper in the tensor pipeline. Asserting the specific PIL error
    # rather than bare Exception, so this cannot start passing for the wrong
    # reason (an AttributeError, say, from a refactor of load_image).
    with pytest.raises(UnidentifiedImageError):
        load_image(b"this is not an image")


def test_exif_orientation_is_applied():
    """A portrait photo must not reach the model sideways.

    Phone cameras store rotation as an EXIF tag instead of rotating pixels.
    Orientation 6 means "rotate 90° CW to display". If exif_transpose is
    skipped the image stays landscape, and the model sees a rotated leaf -
    which degrades accuracy on exactly the photos real farmers take.
    """
    portrait = Image.new("RGB", (40, 80), "green")

    exif = Image.Exif()
    exif[274] = 6  # 274 = Orientation
    raw = io.BytesIO()
    portrait.save(raw, format="JPEG", exif=exif)

    loaded = load_image(raw.getvalue())
    # Applying orientation 6 swaps the axes: 40x80 becomes 80x40.
    assert loaded.size == (80, 40)


def test_compression_bounds_the_long_edge():
    # A 4000px phone photo is pointless to store: the model resizes to 224 and
    # a human reviewer does not need more than MAX_IMAGE_EDGE_PX.
    big = Image.new("RGB", (4000, 3000), "green")
    out = compress_for_storage(big)

    stored = Image.open(io.BytesIO(out))
    assert max(stored.size) == MAX_IMAGE_EDGE_PX
    # Aspect ratio must survive, or lesions get distorted for the reviewer.
    assert stored.size[0] / stored.size[1] == pytest.approx(4000 / 3000, rel=0.01)


def test_compression_does_not_upscale_small_images():
    # thumbnail() only ever shrinks. Pinning it so a later "resize" refactor
    # cannot start inventing pixels.
    small = Image.new("RGB", (120, 90), "green")
    stored = Image.open(io.BytesIO(compress_for_storage(small)))
    assert stored.size == (120, 90)


def test_compression_actually_reduces_size():
    # The whole point of the storage path. A photo with real detail should come
    # out substantially smaller than the PNG original.
    import random

    random.seed(0)
    noisy = Image.new("RGB", (2000, 2000))
    noisy.putdata(
        [
            (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
            for _ in range(2000 * 2000)
        ]
    )

    original = encode(noisy, fmt="PNG")
    assert len(compress_for_storage(noisy)) < len(original)


def test_compress_leaves_the_caller_image_untouched():
    # The same PIL object is handed to the model after being handed here. If
    # compression resized in place, the classifier would silently run on a
    # downscaled, JPEG-degraded image instead of the original.
    image = Image.new("RGB", (3000, 3000), "green")
    compress_for_storage(image)
    assert image.size == (3000, 3000)


def test_storage_output_is_decodable_jpeg():
    out = compress_for_storage(Image.new("RGB", (500, 500), "green"))
    assert Image.open(io.BytesIO(out)).format == "JPEG"
    assert 0 < JPEG_QUALITY <= 100
