"""Procedural robustness perturbations and synthetic negative images.

Nothing here uses real people's photos. Perturbations are applied to whatever image the evaluator supplies (for
example an image from a properly licensed dataset), to measure how much each measurement drifts as image
conditions degrade. Synthetic negatives (no face, no person) check that the engines REJECT rather than score.
"""

from __future__ import annotations

from typing import Callable, Dict, Iterator, List, Optional, Tuple

import cv2
import numpy as np

Perturbation = Callable[[np.ndarray], np.ndarray]


def gaussian_blur(sigma: float) -> Perturbation:
    return lambda img: cv2.GaussianBlur(img, (0, 0), sigmaX=sigma) if sigma > 0 else img.copy()


def exposure(gain: float) -> Perturbation:
    """Multiply intensities by `gain` (<1 under-exposes, >1 over-exposes), clipped to 0..255."""
    return lambda img: np.clip(img.astype(np.float32) * gain, 0, 255).astype(np.uint8)


def gaussian_noise(sigma: float, seed: int = 0) -> Perturbation:
    def apply(img: np.ndarray) -> np.ndarray:
        rng = np.random.default_rng(seed)
        return np.clip(img.astype(np.float32) + rng.normal(0, sigma, img.shape), 0, 255).astype(np.uint8)

    return apply


def jpeg_quality(quality: int) -> Perturbation:
    def apply(img: np.ndarray) -> np.ndarray:
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
        if not ok:
            raise RuntimeError("JPEG encode failed")
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)

    return apply


def rotation(degrees: float) -> Perturbation:
    def apply(img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        m = cv2.getRotationMatrix2D((w / 2, h / 2), degrees, 1.0)
        return cv2.warpAffine(img, m, (w, h), borderMode=cv2.BORDER_REFLECT)

    return apply


def occlusion(fraction: float, seed: int = 0) -> Perturbation:
    """Grey rectangle covering `fraction` of the image area at a seeded random position."""

    def apply(img: np.ndarray) -> np.ndarray:
        out = img.copy()
        h, w = img.shape[:2]
        side = int(np.sqrt(max(0.0, min(1.0, fraction)) * h * w))
        if side <= 0:
            return out
        rng = np.random.default_rng(seed)
        y = int(rng.integers(0, max(1, h - side)))
        x = int(rng.integers(0, max(1, w - side)))
        out[y : y + side, x : x + side] = 128
        return out

    return apply


def downscale(factor: float) -> Perturbation:
    """Downscale by `factor` (e.g. 0.5), then upscale back, losing detail but keeping dimensions."""

    def apply(img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        small = cv2.resize(img, (max(1, int(w * factor)), max(1, int(h * factor))), interpolation=cv2.INTER_AREA)
        return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)

    return apply


def perturbation_suite() -> Iterator[Tuple[str, float, Perturbation]]:
    """(name, strength, function) for every standard perturbation level."""
    for s in (1, 2, 4):
        yield "blur_sigma", s, gaussian_blur(s)
    for g in (0.4, 0.7, 1.3, 1.8):
        yield "exposure_gain", g, exposure(g)
    for s in (5, 15, 30):
        yield "noise_sigma", s, gaussian_noise(s)
    for q in (60, 30, 10):
        yield "jpeg_quality", q, jpeg_quality(q)
    for d in (5, 15, 25):
        yield "rotation_deg", d, rotation(d)
    for f in (0.05, 0.15):
        yield "occlusion_fraction", f, occlusion(f)
    for f in (0.5, 0.25):
        yield "downscale_factor", f, downscale(f)


def synthetic_negatives(size: int = 640) -> Dict[str, np.ndarray]:
    """Images containing no face and no person. Every engine must reject all of them."""
    rng = np.random.default_rng(7)
    gradient = np.tile(np.linspace(0, 255, size, dtype=np.uint8), (size, 1))
    checker = ((np.indices((size, size)).sum(axis=0) // 40) % 2 * 255).astype(np.uint8)
    shapes = np.full((size, size, 3), 200, dtype=np.uint8)
    cv2.circle(shapes, (size // 3, size // 3), size // 6, (40, 80, 200), -1)
    cv2.rectangle(shapes, (size // 2, size // 2), (size - 60, size - 60), (30, 160, 60), -1)
    return {
        "flat_grey": np.full((size, size, 3), 128, dtype=np.uint8),
        "uniform_noise": rng.integers(0, 256, size=(size, size, 3), dtype=np.uint8),
        "gradient": cv2.cvtColor(gradient, cv2.COLOR_GRAY2BGR),
        "checkerboard": cv2.cvtColor(checker, cv2.COLOR_GRAY2BGR),
        "geometric_shapes": shapes,
    }


def stability_report(
    img: np.ndarray, run: Callable[[np.ndarray], Optional[Dict[str, Optional[float]]]]
) -> List[Dict[str, object]]:
    """Run `run` (returns {measurementKey: value} or None when rejected) on the baseline and every perturbation.

    Each row records whether the perturbed image was rejected and the absolute drift of every measurement from
    the baseline. Rows are produced for every perturbation even when the baseline itself is rejected.
    """
    baseline = run(img)
    rows: List[Dict[str, object]] = []
    for name, strength, fn in perturbation_suite():
        out = run(fn(img))
        drift: Dict[str, Optional[float]] = {}
        if baseline is not None and out is not None:
            for k, base_v in baseline.items():
                v = out.get(k)
                drift[k] = None if base_v is None or v is None else abs(float(v) - float(base_v))
        rows.append(
            {
                "perturbation": name,
                "strength": strength,
                "baselineRejected": baseline is None,
                "rejected": out is None,
                "absoluteDrift": drift,
            }
        )
    return rows
