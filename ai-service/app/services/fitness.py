"""Static posture analysis (MediaPipe Pose).

A single photo supports alignment observations only (tilts and angles). Phase 1 changes versus posture-cv@1:
  * mobility is None — it was `posture + 5`, which is not a measurement and cannot be derived from one photo;
  * fitnessScore = round(mean(posture, balance, symmetry)) — a documented composite of measured sub-scores
    (previously the mean of posture and the fabricated mobility);
  * confidence = mean MediaPipe visibility of the landmarks used (previously the nose landmark's presence);
  * the photo is rejected when any landmark used for the calculation has visibility < 0.5.
Sub-score formulas are unchanged.
"""

from __future__ import annotations

import math
from typing import List

import cv2
import mediapipe as mp
import numpy as np

from app.schemas.analysis import FitnessAnalysisResponse, PostureMetrics, PostureQuality
from app.services.image_io import ImageRejected

ENGINE_VERSION = "posture-cv@2"
L_EAR, R_EAR, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 7, 8, 11, 12, 23, 24
USED = (L_EAR, R_EAR, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)
MIN_VISIBILITY = 0.5


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


def analyze_posture(img: np.ndarray) -> FitnessAnalysisResponse:
    h, w = img.shape[:2]
    with mp.solutions.pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
        results = pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if not results.pose_landmarks:
        raise ImageRejected("No body pose detected. Please make sure your full upper body and hips are visible.")
    lm = results.pose_landmarks.landmark

    visibilities = [float(lm[i].visibility) for i in USED]
    if min(visibilities) < MIN_VISIBILITY:
        raise ImageRejected(
            "Ears, shoulders and hips must all be clearly visible for posture analysis. Please stand facing the camera."
        )

    shoulder_tilt = line_tilt(lm[L_SHOULDER], lm[R_SHOULDER])
    hip_tilt = line_tilt(lm[L_HIP], lm[R_HIP])
    head_tilt = line_tilt(lm[L_EAR], lm[R_EAR])

    mid_sh_x = (lm[L_SHOULDER].x + lm[R_SHOULDER].x) / 2
    mid_sh_y = (lm[L_SHOULDER].y + lm[R_SHOULDER].y) / 2
    mid_ear_x = (lm[L_EAR].x + lm[R_EAR].x) / 2
    mid_ear_y = (lm[L_EAR].y + lm[R_EAR].y) / 2
    mid_hip_x = (lm[L_HIP].x + lm[R_HIP].x) / 2
    mid_hip_y = (lm[L_HIP].y + lm[R_HIP].y) / 2

    neck_angle = forward_angle(_P(mid_ear_x, mid_ear_y), _P(mid_sh_x, mid_sh_y))
    spine_deviation = abs(mid_sh_x - mid_hip_x)
    spine_angle = abs(math.degrees(math.atan2(mid_sh_x - mid_hip_x, abs(mid_sh_y - mid_hip_y))))

    findings: List[str] = []
    recs: List[str] = []
    if shoulder_tilt > 2.2:
        findings.append(f"Shoulder line tilted by {shoulder_tilt:.1f}°.")
        recs.append("Single-arm rows and side planks can help balance the shoulders.")
    if neck_angle > 8.5:
        findings.append(f"Head positioned forward of the shoulders by {neck_angle:.1f}°.")
        recs.append("Chin tucks (3×10) and wall angels daily can help with forward head position.")
    if hip_tilt > 2.0:
        findings.append(f"Hip line tilted by {hip_tilt:.1f}°.")
        recs.append("Hip-flexor stretches and single-leg glute bridges can help hip symmetry.")
    if spine_angle > 2.5:
        findings.append(f"Trunk leans {spine_angle:.1f}° from vertical.")
        recs.append("Planks and bird-dogs help stabilise the trunk.")
    if not findings:
        findings.append("No alignment deviations above the screening thresholds in this photo.")
        recs.append("Maintain posture with regular full-body stretching and core work.")

    posture = max(30, min(100, int(100 - shoulder_tilt * 4 - hip_tilt * 4 - neck_angle * 1.8)))
    balance = max(30, min(100, int(100 - spine_deviation * 200 - head_tilt * 3)))
    symmetry = max(30, min(100, int(100 - shoulder_tilt * 5 - hip_tilt * 5)))
    composite = int(round((posture + balance + symmetry) / 3))
    confidence = round(float(np.mean(visibilities)) * 100, 1)

    summary = (
        f"Posture composite {composite}/100 (posture {posture}, balance {balance}, symmetry {symmetry}) from joint "
        f"angles in a single photo: shoulder tilt {shoulder_tilt:.1f}°, hip tilt {hip_tilt:.1f}°, head-forward "
        f"{neck_angle:.1f}°. A static photo cannot assess mobility or movement quality."
    )

    return FitnessAnalysisResponse(
        engineVersion=ENGINE_VERSION,
        fitnessScore=composite,
        postureScore=posture,
        balanceScore=balance,
        symmetryScore=symmetry,
        mobilityScore=None,
        confidence=confidence,
        metrics=PostureMetrics(
            shoulderTiltDeg=round(shoulder_tilt, 2),
            hipTiltDeg=round(hip_tilt, 2),
            headTiltDeg=round(head_tilt, 2),
            neckAngleDeg=round(neck_angle, 2),
            spineAngleDeg=round(spine_angle, 2),
        ),
        findings=findings,
        recommendations=recs,
        summary=summary,
        quality=PostureQuality(width=w, height=h),
    )
