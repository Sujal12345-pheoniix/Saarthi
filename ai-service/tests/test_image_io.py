import struct
import zlib

import cv2
import numpy as np
import pytest

from app.services.image_io import ImageRejected, blur_score, brightness, decode_image, detect_type
from tests.conftest import encode, noise_image, settings


def test_detects_supported_signatures():
    img = noise_image(400, 400)
    assert detect_type(encode(img, ".png")) == "image/png"
    assert detect_type(encode(img, ".jpg")) == "image/jpeg"
    assert detect_type(encode(img, ".webp")) == "image/webp"


@pytest.mark.parametrize(
    "payload",
    [b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', b"<html></html>", b"GIF89a....", b"\x00" * 64],
)
def test_rejects_non_images(payload):
    with pytest.raises(ImageRejected) as exc:
        decode_image(payload, settings())
    assert exc.value.status_code == 415


def test_rejects_empty_and_oversize():
    with pytest.raises(ImageRejected) as e1:
        decode_image(b"", settings())
    assert e1.value.status_code == 400
    small_limit = settings()
    object.__setattr__(small_limit, "max_upload_bytes", 100)
    with pytest.raises(ImageRejected) as e2:
        decode_image(encode(noise_image(400, 400)), small_limit)
    assert e2.value.status_code == 413


def test_rejects_low_resolution():
    with pytest.raises(ImageRejected) as exc:
        decode_image(encode(noise_image(200, 200)), settings())
    assert exc.value.status_code == 422
    assert "Resolution" in exc.value.message


def _png_header(width: int, height: int) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    chunk = b"IHDR" + ihdr
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + chunk + struct.pack(">I", zlib.crc32(chunk)) + b"\x00" * 16


def test_rejects_decompression_bomb_before_decoding():
    with pytest.raises(ImageRejected) as exc:
        decode_image(_png_header(50_000, 50_000), settings())
    assert exc.value.status_code == 400


def test_rejects_corrupted_file():
    data = bytearray(encode(noise_image(400, 400)))
    data[40:80] = b"\x00" * 40
    with pytest.raises(ImageRejected) as exc:
        decode_image(bytes(data), settings())
    assert exc.value.status_code == 400


def test_decodes_valid_image():
    img = decode_image(encode(noise_image(640, 480)), settings())
    assert img.shape == (480, 640, 3)


def test_blur_score_distinguishes_sharp_from_blurry():
    sharp = np.zeros((500, 500), dtype=np.uint8)
    cv2.circle(sharp, (250, 250), 100, 255, -1)
    assert blur_score(sharp) > blur_score(cv2.GaussianBlur(sharp, (21, 21), 0))


def test_brightness_is_mean_intensity():
    assert brightness(np.full((100, 100), 20, dtype=np.uint8)) == 20.0
    assert brightness(np.full((100, 100), 220, dtype=np.uint8)) == 220.0
