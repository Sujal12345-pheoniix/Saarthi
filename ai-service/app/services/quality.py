"""Image-quality index shared by the skin and posture engines.

The quality score is a transparent heuristic used to (a) tell the user how usable a photo is and (b) give the
evaluation framework a covariate. It is NOT a probability that the analysis is correct, and it has not been
calibrated against labelled data.

    sharpness  s = clamp((blurScore - 60) / (300 - 60), 0, 1)       blurScore = variance of the Laplacian
    exposure   e = clamp(1 - |brightness - 128| / 112, 0, 1)        brightness = mean grey level (0-255)
    clipping   c = clamp(1 - (highlightClipPct + shadowClipPct) / 20, 0, 1)
    subject    z = clamp(subjectAreaPct / 25, 0, 1)                 omitted when subject area is unknown

    score = round(100 * (0.35 s + 0.25 e + 0.20 c + 0.20 z) / (sum of weights used))

Clipping percentages are measured inside the subject region when one is supplied (e.g. the face hull), otherwise
over the whole image. Highlight clip = share of pixels >= 250, shadow clip = share of pixels <= 5.
"""

from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

HIGHLIGHT_LEVEL = 250
SHADOW_LEVEL = 5

WEIGHTS = {"sharpness": 0.35, "exposure": 0.25, "clipping": 0.20, "subject": 0.20}

QUALITY_FORMULA = (
    "score = round(100 x weighted mean of sharpness clamp((blur-60)/240), exposure clamp(1-|brightness-128|/112), "
    "clipping clamp(1-(highlightClip%+shadowClip%)/20) and subject size clamp(subjectArea%/25); "
    "weights 0.35/0.25/0.20/0.20, renormalised when subject size is unknown"
)


def _clamp01(v: float) -> float:
    return float(min(1.0, max(0.0, v)))


def clip_percentages(gray: np.ndarray, mask: Optional[np.ndarray] = None) -> Tuple[float, float]:
    """Return (highlightClipPct, shadowClipPct) in percent, over `mask` (non-zero pixels) if given."""
    values = gray[mask > 0] if mask is not None else gray.reshape(-1)
    if values.size == 0:
        return 0.0, 0.0
    hi = float(np.count_nonzero(values >= HIGHLIGHT_LEVEL)) / values.size * 100
    lo = float(np.count_nonzero(values <= SHADOW_LEVEL)) / values.size * 100
    return round(hi, 2), round(lo, 2)


def quality_score(
    blur: float, brightness: float, highlight_pct: float, shadow_pct: float, subject_area_pct: Optional[float]
) -> int:
    parts = {
        "sharpness": _clamp01((blur - 60.0) / (300.0 - 60.0)),
        "exposure": _clamp01(1.0 - abs(brightness - 128.0) / 112.0),
        "clipping": _clamp01(1.0 - (highlight_pct + shadow_pct) / 20.0),
    }
    if subject_area_pct is not None:
        parts["subject"] = _clamp01(subject_area_pct / 25.0)
    total_w = sum(WEIGHTS[k] for k in parts)
    return int(round(100 * sum(WEIGHTS[k] * v for k, v in parts.items()) / total_w))


def quality_limitations(
    blur: float, brightness: float, highlight_pct: float, shadow_pct: float, subject_area_pct: Optional[float]
) -> List[str]:
    notes: List[str] = []
    if blur < 120:
        notes.append("The photo is only moderately sharp; fine texture measurements may be less reliable.")
    if brightness < 70 or brightness > 200:
        notes.append("Lighting is far from even mid-tone exposure; colour-based measurements may be affected.")
    if highlight_pct > 5:
        notes.append(f"{highlight_pct:.1f}% of subject pixels are blown-out highlights; shine and colour readings may be affected.")
    if shadow_pct > 5:
        notes.append(f"{shadow_pct:.1f}% of subject pixels are crushed shadows; detail in dark areas is lost.")
    if subject_area_pct is not None and subject_area_pct < 10:
        notes.append("The subject fills a small part of the frame; measurements use fewer pixels.")
    return notes
