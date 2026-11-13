"""Response contracts (contract version 3). Mirrored by features/analysis/cv-contract.ts in the web app.

Rules that every engine must follow:
* `None` means "not measured by this engine" and must be shown as such — never replaced with a default.
* `Measurement.confidence` is always `None` until an engine is evaluated against labelled reference data;
  no calibrated per-measurement confidence exists today (see docs/ai/EVALUATION.md).
* `observations` describe what is visible in the image. `interpretations` are hedged, possible cosmetic or
  wellness readings of those observations and always carry a caveat. Neither may name a medical condition.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

CONTRACT_VERSION = "3"

Score = Field(ge=0, le=100)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ───────────────────────────── Shared structured contract ─────────────────────────────


class ImageQuality(Strict):
    """Heuristic image-quality index; see app/services/quality.py for the documented formula."""

    passed: bool
    score: int = Field(ge=0, le=100)
    width: int
    height: int
    blurScore: float
    brightness: float
    highlightClipPct: float = Field(ge=0, le=100)
    shadowClipPct: float = Field(ge=0, le=100)
    subjectAreaPct: Optional[float] = Field(default=None, ge=0, le=100)
    limitations: List[str]


class Measurement(Strict):
    key: str
    label: str
    value: Optional[float]
    unit: Literal["count", "index_0_100", "percent", "degrees", "ratio"]
    higherIs: Literal["more_pronounced", "better", "neutral"]
    source: str
    method: str
    # No calibrated confidence exists for any measurement yet. The type forbids inventing one.
    confidence: None = None
    explanation: str
    limitations: List[str]


class Observation(Strict):
    key: str
    text: str
    measurementKeys: List[str]


class Interpretation(Strict):
    text: str
    measurementKeys: List[str]
    caveat: str


# ───────────────────────────── Skin ─────────────────────────────


class SkinMetrics(Strict):
    """Legacy flat metrics (kept for compatibility). Names are historical; meanings are documented below.

    acneCount           = number of reddish spot-like regions (NOT an acne count)
    rednessScore        = red-hue pixel share index
    pigmentationScore   = local dark-spot contrast index
    wrinkleScore        = forehead line-like edge density index
    drynessScore        = cheek texture variance index (NOT hydration or dryness)
    oilinessScore       = T-zone specular highlight index
    skinUniformityScore = cheek-to-cheek colour similarity index
    """

    acneCount: int = Field(ge=0)
    rednessScore: int = Score
    pigmentationScore: int = Score
    wrinkleScore: Optional[int] = Score
    drynessScore: Optional[int] = Score
    oilinessScore: Optional[int] = Score
    skinUniformityScore: Optional[int] = Score


class SkinQuality(Strict):
    width: int
    height: int
    blurScore: float
    brightness: float


class SkinAnalysisResponse(Strict):
    engine: Literal["saarthi-cv"] = "saarthi-cv"
    engineVersion: str
    contractVersion: Literal["3"] = CONTRACT_VERSION
    skinScore: int = Score
    # A photograph cannot measure hydration; always None from skin-cv@3.
    hydrationScore: Optional[int] = Score
    # Acne is not labelled from photos; always None from skin-cv@3 (see measurement `reddishSpotCount`).
    acneSeverity: Optional[int] = Score
    confidence: Optional[float] = Field(default=None, ge=0, le=100)
    metrics: SkinMetrics
    findings: List[str]
    recommendations: List[str]
    summary: str
    quality: SkinQuality
    imageQuality: ImageQuality
    measurements: List[Measurement]
    observations: List[Observation]
    interpretations: List[Interpretation]
    limitations: List[str]
    compositeFormula: str


# ───────────────────────────── Posture ─────────────────────────────


class PostureMetrics(Strict):
    """Flat posture metrics in degrees (pixel-space angles, normalised to [0, 90]).

    Frontal view: shoulderTiltDeg, hipTiltDeg, headTiltDeg, headLateralOffsetDeg, trunkLateralLeanDeg,
                  torsoSideLengthDiffPct. Side-view fields are None.
    Side view:    headForwardAngleDeg, trunkSagittalLeanDeg. Frontal fields are None.
    neckAngleDeg / spineAngleDeg are kept for compatibility:
      neckAngleDeg  = headForwardAngleDeg (side view only; None in frontal view — a frontal photo cannot
                      measure forward head position)
      spineAngleDeg = trunkLateralLeanDeg (frontal) or trunkSagittalLeanDeg (side)
    """

    view: Literal["frontal", "side"]
    shoulderTiltDeg: Optional[float] = None
    hipTiltDeg: Optional[float] = None
    headTiltDeg: Optional[float] = None
    headLateralOffsetDeg: Optional[float] = None
    trunkLateralLeanDeg: Optional[float] = None
    torsoSideLengthDiffPct: Optional[float] = None
    headForwardAngleDeg: Optional[float] = None
    trunkSagittalLeanDeg: Optional[float] = None
    neckAngleDeg: Optional[float] = None
    spineAngleDeg: Optional[float] = None


class PostureQuality(Strict):
    width: int
    height: int


class FitnessAnalysisResponse(Strict):
    engine: Literal["saarthi-cv"] = "saarthi-cv"
    engineVersion: str
    contractVersion: Literal["3"] = CONTRACT_VERSION
    view: Literal["frontal", "side"]
    fitnessScore: int = Score
    postureScore: Optional[int] = Score
    balanceScore: Optional[int] = Score
    symmetryScore: Optional[int] = Score
    # Mobility cannot be measured from a single photo; always None.
    mobilityScore: Optional[int] = Score
    # Mean MediaPipe landmark visibility x100 — NOT a calibrated accuracy.
    confidence: Optional[float] = Field(default=None, ge=0, le=100)
    metrics: PostureMetrics
    findings: List[str]
    recommendations: List[str]
    summary: str
    quality: PostureQuality
    imageQuality: ImageQuality
    measurements: List[Measurement]
    observations: List[Observation]
    interpretations: List[Interpretation]
    limitations: List[str]
    compositeFormula: str
