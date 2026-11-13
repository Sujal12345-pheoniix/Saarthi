"""Response contracts. Mirrored by features/analysis/cv-contract.ts in the web app.

`None` means "not measured by this engine" and must be shown as such — never replaced with a default.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Score = Field(ge=0, le=100)


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SkinMetrics(Strict):
    acneCount: int = Field(ge=0)
    rednessScore: int = Score
    pigmentationScore: int = Score
    wrinkleScore: int = Score
    drynessScore: Optional[int] = Score
    oilinessScore: int = Score
    skinUniformityScore: Optional[int] = Score


class SkinQuality(Strict):
    width: int
    height: int
    blurScore: float
    brightness: float


class SkinAnalysisResponse(Strict):
    engine: Literal["saarthi-cv"] = "saarthi-cv"
    engineVersion: str
    skinScore: int = Score
    hydrationScore: Optional[int] = Score
    acneSeverity: int = Score
    confidence: Optional[float] = Field(default=None, ge=0, le=100)
    metrics: SkinMetrics
    findings: List[str]
    recommendations: List[str]
    summary: str
    quality: SkinQuality


class PostureMetrics(Strict):
    shoulderTiltDeg: float
    hipTiltDeg: float
    headTiltDeg: float
    neckAngleDeg: float
    spineAngleDeg: float


class PostureQuality(Strict):
    width: int
    height: int


class FitnessAnalysisResponse(Strict):
    engine: Literal["saarthi-cv"] = "saarthi-cv"
    engineVersion: str
    fitnessScore: int = Score
    postureScore: int = Score
    balanceScore: int = Score
    symmetryScore: int = Score
    mobilityScore: Optional[int] = Score
    confidence: Optional[float] = Field(default=None, ge=0, le=100)
    metrics: PostureMetrics
    findings: List[str]
    recommendations: List[str]
    summary: str
    quality: PostureQuality
