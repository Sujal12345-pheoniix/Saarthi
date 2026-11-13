"""Static posture alignment analysis (MediaPipe Pose) — engine posture-cv@3.

A single photo supports ALIGNMENT OBSERVATIONS only. It cannot measure mobility, range of motion, strength,
cardiovascular fitness or body composition, and this engine does not attempt to.

Coordinate system
  MediaPipe Pose returns landmarks in normalised image coordinates: origin at the top-left corner, x to the right,
  y DOWN, both in [0, 1]. They are converted to pixel coordinates (x*width, y*height) before any angle is
  computed, so angles are correct for non-square photos (posture-cv@2 computed angles in normalised units, which
  distorts them whenever width != height). Angles are in degrees and normalised to [0, 90]:
    line_tilt(a, b)       = angle of segment a-b from HORIZONTAL (0 = level), independent of point order
    forward_angle(t, b)   = angle of segment b->t from VERTICAL (0 = t directly above b)

View classification (thresholds documented in docs/ai/POSTURE_ENGINE.md)
  r = |x_left_shoulder - x_right_shoulder| / |y_mid_shoulder - y_mid_hip|        (pixel units)
  frontal if r >= 0.50; side if r <= 0.25; otherwise "unknown" (oblique) -> rejected.
  For a side view the visible side is the one with the higher mean visibility of its ear, shoulder and hip.

Measurements
  Frontal: shoulderTiltDeg, hipTiltDeg, headTiltDeg (ear line), headLateralOffsetDeg (ear midpoint relative to
           shoulder midpoint, from vertical), trunkLateralLeanDeg (shoulder midpoint over hip midpoint, from
           vertical), torsoSideLengthDiffPct (|left - right shoulder-to-hip length| / mean x 100).
  Side:    headForwardAngleDeg (ear relative to shoulder, from vertical), craniovertebralApproxDeg
           (90 - headForwardAngleDeg; an approximation of the craniovertebral angle using the shoulder landmark
           in place of C7), trunkSagittalLeanDeg (shoulder over hip, from vertical).

Limitations: camera height and tilt, lens distortion, loose clothing, hair and stance all change these angles;
the thresholds are uncalibrated screening heuristics and have not been validated against clinical measurement.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional, Sequence, Tuple

import cv2
import mediapipe as mp
import numpy as np

from app.schemas.analysis import (
    FitnessAnalysisResponse,
    ImageQuality,
    Interpretation,
    Measurement,
    Observation,
    PostureMetrics,
    PostureQuality,
)
from app.services.image_io import ImageRejected, blur_score, brightness
from app.services.quality import clip_percentages, quality_limitations, quality_score

ENGINE_VERSION = "posture-cv@3"

NOSE = 0
L_EAR, R_EAR, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 7, 8, 11, 12, 23, 24
FRONTAL_USED = (L_EAR, R_EAR, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)
SIDE_USED = {"left": (L_EAR, L_SHOULDER, L_HIP), "right": (R_EAR, R_SHOULDER, R_HIP)}

MIN_VISIBILITY = 0.5
FRAME_MARGIN = 0.02
FRONTAL_MIN_RATIO = 0.50
SIDE_MAX_RATIO = 0.25
MIN_TORSO_HEIGHT_FRAC = 0.05
MIN_BLUR = 15.0
MIN_BRIGHTNESS, MAX_BRIGHTNESS = 40.0, 240.0

# Observation thresholds (screening heuristics, uncalibrated).
SHOULDER_TILT_T = 2.2
HIP_TILT_T = 2.0
HEAD_LATERAL_T = 8.5
TRUNK_LATERAL_T = 2.5
TORSO_DIFF_T = 8.0
HEAD_FORWARD_T = 40.0  # i.e. approximate craniovertebral angle below 50 degrees
TRUNK_SAGITTAL_T = 5.0

View = Literal["frontal", "side", "unknown"]

COMPOSITE_FORMULA = (
    "Frontal: postureScore = clamp(100 - 4 x shoulderTilt - 4 x hipTilt - 1.8 x headLateralOffset); "
    "balanceScore = clamp(100 - 3 x trunkLateralLean - 3 x headTilt); "
    "symmetryScore = clamp(100 - 5 x shoulderTilt - 5 x hipTilt - torsoSideLengthDiffPct). "
    "Side: postureScore = clamp(100 - 1.5 x max(0, headForwardAngle - 15) - 3 x trunkSagittalLean); balance and "
    "symmetry are not measured. fitnessScore = round(mean of the sub-scores measured for the view). All angles in "
    "degrees, clamp to [0, 100]. A posture-alignment composite only: it does not measure fitness, mobility or strength."
)

ENGINE_LIMITATIONS = [
    "A single photo supports alignment observations only. Mobility, strength, cardiovascular fitness and body "
    "composition cannot be measured from it.",
    "Angles depend on camera height and tilt, lens distortion, stance, loose clothing and hair.",
    "Thresholds are uncalibrated screening heuristics and have not been validated against clinical posture assessment.",
    "The confidence value is MediaPipe's mean landmark visibility, not a calibrated accuracy.",
]


class _P:
    def __init__(self, x: float, y: float):
        self.x, self.y = x, y


def line_tilt(a, b) -> float:
    """Angle of the line a→b from horizontal, in [0, 90] degrees, independent of point order.

    MediaPipe's "left" landmarks are the subject's left, i.e. on the image RIGHT for a person facing the camera,
    so a raw atan2 returns ~180° for a perfectly level line. posture-cv@1 used the raw value, which pinned every
    frontal photo to the minimum posture score.
    """
    t = abs(math.degrees(math.atan2(b.y - a.y, b.x - a.x)))
    return min(t, 180 - t)


def forward_angle(top, bottom) -> float:
    """Angle of the segment bottom→top from vertical, in [0, 90] degrees."""
    t = abs(math.degrees(math.atan2(top.x - bottom.x, top.y - bottom.y)))
    return min(t, 180 - t)


def _clamp(v: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, v))


def _mid(a: _P, b: _P) -> _P:
    return _P((a.x + b.x) / 2, (a.y + b.y) / 2)


def _dist(a: _P, b: _P) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


# ───────────────────────────── View, framing, visibility (unit-tested) ─────────────────────────────


@dataclass
class Landmark:
    """Normalised coordinates plus visibility, as produced by MediaPipe."""

    x: float
    y: float
    visibility: float


def to_pixels(lm: Sequence[Landmark], w: int, h: int) -> Dict[int, _P]:
    return {i: _P(p.x * w, p.y * h) for i, p in enumerate(lm)}


def classify_view(lm: Sequence[Landmark], w: int, h: int) -> Tuple[View, Optional[str], float]:
    """Return (view, visible side for side view, shoulder-width / torso-height ratio)."""
    px = to_pixels(lm, w, h)
    torso_h = abs(_mid(px[L_SHOULDER], px[R_SHOULDER]).y - _mid(px[L_HIP], px[R_HIP]).y)
    if torso_h < MIN_TORSO_HEIGHT_FRAC * h:
        return "unknown", None, 0.0
    ratio = abs(px[L_SHOULDER].x - px[R_SHOULDER].x) / torso_h
    if ratio >= FRONTAL_MIN_RATIO:
        return "frontal", None, ratio
    if ratio <= SIDE_MAX_RATIO:
        left_vis = float(np.mean([lm[i].visibility for i in SIDE_USED["left"]]))
        right_vis = float(np.mean([lm[i].visibility for i in SIDE_USED["right"]]))
        return "side", ("left" if left_vis >= right_vis else "right"), ratio
    return "unknown", None, ratio


def in_frame(lm: Sequence[Landmark], indices: Sequence[int], margin: float = FRAME_MARGIN) -> bool:
    return all(margin <= lm[i].x <= 1 - margin and margin <= lm[i].y <= 1 - margin for i in indices)


def used_landmarks(view: View, side: Optional[str]) -> Tuple[int, ...]:
    return FRONTAL_USED if view == "frontal" else SIDE_USED[side or "left"]


# ───────────────────────────── Measurements → report (pure, unit-tested) ─────────────────────────────


@dataclass
class PostureValues:
    view: Literal["frontal", "side"]
    shoulder_tilt: Optional[float] = None
    hip_tilt: Optional[float] = None
    head_tilt: Optional[float] = None
    head_lateral_offset: Optional[float] = None
    trunk_lateral_lean: Optional[float] = None
    torso_side_diff_pct: Optional[float] = None
    head_forward: Optional[float] = None
    trunk_sagittal_lean: Optional[float] = None
    visible_side: Optional[str] = None


def measure(lm: Sequence[Landmark], w: int, h: int, view: Literal["frontal", "side"], side: Optional[str]) -> PostureValues:
    px = to_pixels(lm, w, h)
    if view == "frontal":
        sh_mid, hip_mid, ear_mid = _mid(px[L_SHOULDER], px[R_SHOULDER]), _mid(px[L_HIP], px[R_HIP]), _mid(px[L_EAR], px[R_EAR])
        left_len, right_len = _dist(px[L_SHOULDER], px[L_HIP]), _dist(px[R_SHOULDER], px[R_HIP])
        mean_len = (left_len + right_len) / 2
        return PostureValues(
            view="frontal",
            shoulder_tilt=line_tilt(px[L_SHOULDER], px[R_SHOULDER]),
            hip_tilt=line_tilt(px[L_HIP], px[R_HIP]),
            head_tilt=line_tilt(px[L_EAR], px[R_EAR]),
            head_lateral_offset=forward_angle(ear_mid, sh_mid),
            trunk_lateral_lean=forward_angle(sh_mid, hip_mid),
            torso_side_diff_pct=abs(left_len - right_len) / mean_len * 100 if mean_len > 0 else None,
        )
    ear, shoulder, hip = (px[i] for i in SIDE_USED[side or "left"])
    return PostureValues(
        view="side",
        head_forward=forward_angle(ear, shoulder),
        trunk_sagittal_lean=forward_angle(shoulder, hip),
        visible_side=side,
    )


def sub_scores(v: PostureValues) -> Dict[str, Optional[int]]:
    if v.view == "frontal":
        assert v.shoulder_tilt is not None and v.hip_tilt is not None and v.head_lateral_offset is not None
        posture = _clamp(100 - 4 * v.shoulder_tilt - 4 * v.hip_tilt - 1.8 * v.head_lateral_offset)
        balance = _clamp(100 - 3 * (v.trunk_lateral_lean or 0) - 3 * (v.head_tilt or 0))
        symmetry = _clamp(100 - 5 * v.shoulder_tilt - 5 * v.hip_tilt - (v.torso_side_diff_pct or 0))
        return {"posture": int(round(posture)), "balance": int(round(balance)), "symmetry": int(round(symmetry))}
    assert v.head_forward is not None and v.trunk_sagittal_lean is not None
    posture = _clamp(100 - 1.5 * max(0.0, v.head_forward - 15) - 3 * v.trunk_sagittal_lean)
    return {"posture": int(round(posture)), "balance": None, "symmetry": None}


def composite(scores: Dict[str, Optional[int]]) -> int:
    vals = [s for s in scores.values() if s is not None]
    return int(round(sum(vals) / len(vals)))


def _r(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(float(v), 2)


ANGLE_LIMITS = ["Sensitive to camera tilt, stance and clothing.", "Screening heuristic; not a clinical measurement."]


def _m(key, label, value, unit, method, explanation, extra_limits=()) -> Measurement:
    return Measurement(
        key=key,
        label=label,
        value=_r(value),
        unit=unit,
        higherIs="neutral" if unit == "ratio" else "more_pronounced",
        source="mediapipe:pose-landmarks(pixel-space)",
        method=method,
        explanation=explanation,
        limitations=list(ANGLE_LIMITS) + list(extra_limits),
    )


def build_measurements(v: PostureValues, view_ratio: float) -> List[Measurement]:
    ratio = Measurement(
        key="viewRatio",
        label="Shoulder width / torso height",
        value=round(view_ratio, 3),
        unit="ratio",
        higherIs="neutral",
        source="mediapipe:pose-landmarks(pixel-space)",
        method="|x(left shoulder) - x(right shoulder)| / |y(shoulder midpoint) - y(hip midpoint)|; frontal if >= 0.50, side if <= 0.25.",
        explanation="Used to decide whether the photo is a frontal or side view.",
        limitations=["People with very broad or narrow shoulders, or a rotated stance, can be misclassified."],
    )
    if v.view == "frontal":
        return [
            ratio,
            _m("shoulderTiltDeg", "Shoulder line tilt", v.shoulder_tilt, "degrees", "Angle of the left-right shoulder line from horizontal.", "How far the shoulders are from level."),
            _m("hipTiltDeg", "Hip line tilt", v.hip_tilt, "degrees", "Angle of the left-right hip line from horizontal.", "How far the hips are from level.", ["Hip landmarks are estimated through clothing."]),
            _m("headTiltDeg", "Head tilt (ear line)", v.head_tilt, "degrees", "Angle of the left-right ear line from horizontal.", "How far the head is tilted sideways.", ["Hair covering the ears reduces accuracy."]),
            _m("headLateralOffsetDeg", "Head lateral offset", v.head_lateral_offset, "degrees", "Angle of the shoulder-midpoint to ear-midpoint segment from vertical.", "How far the head sits to one side of the shoulders."),
            _m("trunkLateralLeanDeg", "Trunk lateral lean", v.trunk_lateral_lean, "degrees", "Angle of the hip-midpoint to shoulder-midpoint segment from vertical.", "How far the upper body leans to one side."),
            _m("torsoSideLengthDiffPct", "Left/right torso length difference", v.torso_side_diff_pct, "percent", "|left shoulder-hip length - right shoulder-hip length| / mean length x 100.", "How different the two sides of the torso appear in length.", ["Body rotation towards the camera changes this."]),
        ]
    craniovertebral = None if v.head_forward is None else 90.0 - v.head_forward
    return [
        ratio,
        _m("headForwardAngleDeg", "Head forward angle", v.head_forward, "degrees", f"Angle of the {v.visible_side} shoulder to ear segment from vertical.", "How far the ear sits in front of (or behind) the shoulder."),
        _m("craniovertebralApproxDeg", "Approximate craniovertebral angle", craniovertebral, "degrees", "90 - head forward angle (uses the shoulder landmark in place of the C7 vertebra).", "An approximation of a common posture angle; lower values mean the head is further forward.", ["Not equivalent to a clinically measured craniovertebral angle."]),
        _m("trunkSagittalLeanDeg", "Trunk forward/backward lean", v.trunk_sagittal_lean, "degrees", f"Angle of the {v.visible_side} hip to shoulder segment from vertical.", "How far the upper body leans forward or backward."),
    ]


def build_observations(v: PostureValues) -> List[Observation]:
    o: List[Observation] = []
    if v.view == "frontal":
        if v.shoulder_tilt is not None and v.shoulder_tilt > SHOULDER_TILT_T:
            o.append(Observation(key="shoulders", text=f"The shoulder line is tilted by {v.shoulder_tilt:.1f} degrees.", measurementKeys=["shoulderTiltDeg"]))
        if v.hip_tilt is not None and v.hip_tilt > HIP_TILT_T:
            o.append(Observation(key="hips", text=f"The hip line is tilted by {v.hip_tilt:.1f} degrees.", measurementKeys=["hipTiltDeg"]))
        if v.head_lateral_offset is not None and v.head_lateral_offset > HEAD_LATERAL_T:
            o.append(Observation(key="headLateral", text=f"The head sits {v.head_lateral_offset:.1f} degrees to one side of the shoulders.", measurementKeys=["headLateralOffsetDeg"]))
        if v.trunk_lateral_lean is not None and v.trunk_lateral_lean > TRUNK_LATERAL_T:
            o.append(Observation(key="trunkLateral", text=f"The upper body leans {v.trunk_lateral_lean:.1f} degrees to one side.", measurementKeys=["trunkLateralLeanDeg"]))
        if v.torso_side_diff_pct is not None and v.torso_side_diff_pct > TORSO_DIFF_T:
            o.append(Observation(key="torsoSides", text=f"The left and right sides of the torso differ in apparent length by {v.torso_side_diff_pct:.0f}%.", measurementKeys=["torsoSideLengthDiffPct"]))
    else:
        if v.head_forward is not None and v.head_forward > HEAD_FORWARD_T:
            o.append(Observation(key="headForward", text=f"The ear is positioned forward of the shoulder ({v.head_forward:.1f} degrees from vertical).", measurementKeys=["headForwardAngleDeg", "craniovertebralApproxDeg"]))
        if v.trunk_sagittal_lean is not None and v.trunk_sagittal_lean > TRUNK_SAGITTAL_T:
            o.append(Observation(key="trunkSagittal", text=f"The upper body leans {v.trunk_sagittal_lean:.1f} degrees from vertical.", measurementKeys=["trunkSagittalLeanDeg"]))
    if not o:
        o.append(Observation(key="aligned", text="No alignment deviations above the screening thresholds were found in this photo.", measurementKeys=[]))
    return o


INTERPRETATIONS = {
    "shoulders": Interpretation(text="A tilted shoulder line can be associated with habitual posture or muscle imbalance, but is often caused by stance or how the arms are held.", measurementKeys=["shoulderTiltDeg"], caveat="Retake the photo standing relaxed with arms by your sides before drawing conclusions."),
    "hips": Interpretation(text="A tilted hip line may reflect weight shifted onto one leg at the moment of the photo.", measurementKeys=["hipTiltDeg"], caveat="Stand with weight evenly on both feet and compare several photos."),
    "headLateral": Interpretation(text="A head offset to one side may reflect habitual head position or simply the pose in this photo.", measurementKeys=["headLateralOffsetDeg"], caveat="A single photo shows one moment, not a habit."),
    "trunkLateral": Interpretation(text="A sideways lean of the upper body may come from stance or weight shift.", measurementKeys=["trunkLateralLeanDeg"], caveat="Camera tilt produces the same effect; keep the camera level."),
    "torsoSides": Interpretation(text="A difference in apparent torso side length often comes from rotating towards the camera or leaning.", measurementKeys=["torsoSideLengthDiffPct"], caveat="Face the camera squarely before comparing."),
    "headForward": Interpretation(text="An ear positioned well forward of the shoulder can be associated with a forward head posture, which is common with long periods of screen use.", measurementKeys=["headForwardAngleDeg"], caveat="Camera height and looking up or down change this angle; a physiotherapist can assess posture properly."),
    "trunkSagittal": Interpretation(text="A forward or backward trunk lean may reflect stance at the moment of the photo.", measurementKeys=["trunkSagittalLeanDeg"], caveat="Stand naturally and keep the camera at hip height and level."),
}

RECOMMENDATIONS = {
    "shoulders": "Gentle shoulder mobility work and balanced upper-back exercises (for example rows) may help shoulder alignment over time.",
    "hips": "Practise standing with weight evenly on both feet; single-leg balance work and glute bridges are common general exercises.",
    "headLateral": "Check your screen and desk set-up so your head can stay centred and upright.",
    "trunkLateral": "Core-stability exercises such as planks and bird-dogs are commonly used to support upright posture.",
    "torsoSides": "Retake the photo facing the camera squarely; if the difference persists, a physiotherapist can assess it.",
    "headForward": "Raise screens towards eye level and take regular breaks; chin-tuck exercises are commonly recommended for head position.",
    "trunkSagittal": "Regular movement breaks and core-stability exercises can support an upright stance.",
}
GENERAL_RECOMMENDATIONS = [
    "Keep up regular full-body movement and stretching.",
    "Consult a physiotherapist or other qualified professional if you have pain, numbness or ongoing discomfort.",
]


def build_interpretations(observations: Sequence[Observation]) -> List[Interpretation]:
    return [INTERPRETATIONS[o.key] for o in observations if o.key in INTERPRETATIONS]


def build_recommendations(observations: Sequence[Observation]) -> List[str]:
    return [RECOMMENDATIONS[o.key] for o in observations if o.key in RECOMMENDATIONS] + list(GENERAL_RECOMMENDATIONS)


def build_summary(v: PostureValues, scores: Dict[str, Optional[int]], fitness: int) -> str:
    if v.view == "frontal":
        detail = (
            f"shoulder tilt {v.shoulder_tilt:.1f} degrees, hip tilt {v.hip_tilt:.1f} degrees, "
            f"head offset {v.head_lateral_offset:.1f} degrees"
        )
    else:
        detail = f"head forward angle {v.head_forward:.1f} degrees, trunk lean {v.trunk_sagittal_lean:.1f} degrees"
    measured = ", ".join(f"{k} {s}" for k, s in scores.items() if s is not None)
    return (
        f"Posture alignment composite {fitness}/100 ({measured}) from a single {v.view}-view photo: {detail}. "
        "A static photo cannot assess mobility, strength or movement quality."
    )


def build_metrics(v: PostureValues) -> PostureMetrics:
    return PostureMetrics(
        view=v.view,
        shoulderTiltDeg=_r(v.shoulder_tilt),
        hipTiltDeg=_r(v.hip_tilt),
        headTiltDeg=_r(v.head_tilt),
        headLateralOffsetDeg=_r(v.head_lateral_offset),
        trunkLateralLeanDeg=_r(v.trunk_lateral_lean),
        torsoSideLengthDiffPct=_r(v.torso_side_diff_pct),
        headForwardAngleDeg=_r(v.head_forward),
        trunkSagittalLeanDeg=_r(v.trunk_sagittal_lean),
        neckAngleDeg=_r(v.head_forward),
        spineAngleDeg=_r(v.trunk_lateral_lean if v.view == "frontal" else v.trunk_sagittal_lean),
    )


# ───────────────────────────── Engine ─────────────────────────────


def analyze_posture(img: np.ndarray) -> FitnessAnalysisResponse:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = blur_score(gray)
    light = brightness(gray)
    if light < MIN_BRIGHTNESS:
        raise ImageRejected("Low lighting detected. Please take the photo in a well-lit place.")
    if light > MAX_BRIGHTNESS:
        raise ImageRejected("Overexposed photo detected. Please avoid direct harsh light.")
    if blur < MIN_BLUR:
        raise ImageRejected(f"Image too blurry (sharpness {blur:.1f}). Please hold the camera steady.")

    with mp.solutions.pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
        results = pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if not results.pose_landmarks:
        raise ImageRejected("No body pose detected. Please make sure your full upper body and hips are visible.")
    lm = [Landmark(p.x, p.y, float(p.visibility)) for p in results.pose_landmarks.landmark]

    view, side, ratio = classify_view(lm, w, h)
    if view == "unknown":
        raise ImageRejected(
            "Could not tell whether this is a front or side view. Please stand facing the camera, or exactly side-on."
        )
    used = used_landmarks(view, side)
    if min(lm[i].visibility for i in used) < MIN_VISIBILITY:
        raise ImageRejected(
            "Ears, shoulders and hips must be clearly visible for posture analysis. Please check lighting and clothing."
            if view == "frontal"
            else "Your ear, shoulder and hip on the side facing the camera must be clearly visible."
        )
    if not in_frame(lm, used):
        raise ImageRejected("Please step back so your full upper body and hips are in the frame.")

    values = measure(lm, w, h, view, side)
    scores = sub_scores(values)
    fitness = composite(scores)
    confidence = round(float(np.mean([lm[i].visibility for i in used])) * 100, 1)

    visible = [p for p in lm if p.visibility >= MIN_VISIBILITY]
    xs, ys = [p.x for p in visible], [p.y for p in visible]
    subject_area = (max(xs) - min(xs)) * (max(ys) - min(ys)) * 100 if visible else None
    subject_area = None if subject_area is None else round(_clamp(subject_area), 2)
    hi_clip, lo_clip = clip_percentages(gray)
    q_limits = quality_limitations(blur, light, hi_clip, lo_clip, subject_area)
    image_quality = ImageQuality(
        passed=True,
        score=quality_score(blur, light, hi_clip, lo_clip, subject_area),
        width=w,
        height=h,
        blurScore=round(blur, 2),
        brightness=round(light, 2),
        highlightClipPct=hi_clip,
        shadowClipPct=lo_clip,
        subjectAreaPct=subject_area,
        limitations=q_limits,
    )

    observations = build_observations(values)
    return FitnessAnalysisResponse(
        engineVersion=ENGINE_VERSION,
        view=values.view,
        fitnessScore=fitness,
        postureScore=scores["posture"],
        balanceScore=scores["balance"],
        symmetryScore=scores["symmetry"],
        mobilityScore=None,
        confidence=confidence,
        metrics=build_metrics(values),
        findings=[o.text for o in observations],
        recommendations=build_recommendations(observations),
        summary=build_summary(values, scores, fitness),
        quality=PostureQuality(width=w, height=h),
        imageQuality=image_quality,
        measurements=build_measurements(values, ratio),
        observations=observations,
        interpretations=build_interpretations(observations),
        limitations=list(ENGINE_LIMITATIONS) + q_limits,
        compositeFormula=COMPOSITE_FORMULA,
    )
