"""Decode and validate uploaded image bytes. The service never fetches images from URLs."""

from __future__ import annotations

from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from app.core.config import Settings


class ImageRejected(Exception):
    """Input is not an acceptable image. `message` is safe to show to the end user."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


SIGNATURES = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda b: len(b) >= 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


def detect_type(data: bytes) -> str | None:
    for mime, check in SIGNATURES.items():
        if check(data):
            return mime
    return None


def decode_image(data: bytes, settings: Settings) -> np.ndarray:
    """Validate signature, size, dimensions and integrity; return a BGR image."""
    if not data:
        raise ImageRejected("The image is empty.", 400)
    if len(data) > settings.max_upload_bytes:
        raise ImageRejected("The image exceeds the maximum upload size.", 413)
    if detect_type(data) is None:
        raise ImageRejected("Only JPEG, PNG and WEBP images are supported.", 415)

    # Read dimensions from the header BEFORE decoding pixels (decompression-bomb guard).
    Image.MAX_IMAGE_PIXELS = settings.max_pixels
    try:
        with Image.open(BytesIO(data)) as probe:
            width, height = probe.size
            if width * height > settings.max_pixels:
                raise ImageRejected("The image dimensions are too large.", 400)
            probe.verify()
    except ImageRejected:
        raise
    except Exception as exc:  # PIL raises many types for corrupt input
        raise ImageRejected("The image file is corrupted or unreadable.", 400) from exc

    if width < settings.min_dimension or height < settings.min_dimension:
        raise ImageRejected(
            f"Resolution below threshold ({width}x{height}). Please upload at least "
            f"{settings.min_dimension}x{settings.min_dimension} pixels.",
        )
    if width > settings.max_dimension or height > settings.max_dimension:
        raise ImageRejected("The image dimensions are too large.", 400)

    img = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ImageRejected("The image could not be decoded.", 400)
    return img


def blur_score(gray: np.ndarray) -> float:
    """Variance of the Laplacian — higher means sharper."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def brightness(gray: np.ndarray) -> float:
    return float(np.mean(gray))
