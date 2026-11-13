"""Skin image analysis (OpenCV + MediaPipe Face Mesh).

These are image heuristics over facial regions, NOT clinical measurements: "acne-like spots" are small
reddish circular contours, "dryness" is cheek texture variance, "oiliness" is specular highlight share.
The thresholds are uncalibrated (see docs/audit/TECHNICAL_DEBT.md TD-11). Phase 1 changes versus the
audited code (skin-cv@1):
  * confidence is None — the previous constant 95 was not a measurement;
  * dryness / uniformity are None when their regions could not be extracted (previously constants 30 / 75);
  * the summary is generated from the measured values (previously contained a fixed sentence).
Scoring formulas are otherwise unchanged so results stay comparable.
"""

from __future__ import annotations

from typing import List, Optional

import cv2
import mediapipe as mp
import numpy as np

from app.schemas.analysis import SkinAnalysisResponse, SkinMetrics, SkinQuality
from app.services.image_io import ImageRejected, blur_score, brightness

ENGINE_VERSION = "skin-cv@2"

FOREHEAD = [67, 109, 10, 338, 297, 8, 9]
LEFT_CHEEK = [50, 123, 147, 187, 205, 137]
RIGHT_CHEEK = [280, 352, 376, 409, 425, 366]
T_ZONE = [168, 6, 197, 195, 5, 4, 1, 19, 94]


def analyze_skin(img: np.ndarray) -> SkinAnalysisResponse:
    h, w = img.shape[:2]
    if w < 480 or h < 480:
        raise ImageRejected("Resolution below threshold. Please upload an image of at least 480x480 pixels.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = blur_score(gray)
    if blur < 60.0:
        raise ImageRejected(f"Image too blurry (sharpness {blur:.1f}). Please upload a sharp, well-focused photo.")
    light = brightness(gray)
    if light < 40.0:
        raise ImageRejected("Low lighting detected. Please capture the photo in a well-lit environment.")
    if light > 240.0:
        raise ImageRejected("Overexposed photo detected. Please avoid direct harsh light.")

    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=2, refine_landmarks=True) as mesh:
        results = mesh.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        raise ImageRejected("Face not visible. Please position your face clearly in front of the camera.")
    if len(results.multi_face_landmarks) > 1:
        raise ImageRejected("Multiple faces detected. Please make sure only one person is in the frame.")
    lm = results.multi_face_landmarks[0].landmark

    def crop(indices: List[int]) -> Optional[np.ndarray]:
        pts = np.array([(int(lm[i].x * w), int(lm[i].y * h)) for i in indices], dtype=np.int32)
        x, y, cw, ch = cv2.boundingRect(pts)
        x, y = max(0, x), max(0, y)
        cw, ch = min(w - x, cw), min(h - y, ch)
        return img[y : y + ch, x : x + cw] if cw > 10 and ch > 10 else None

    forehead, l_cheek, r_cheek, t_zone = crop(FOREHEAD), crop(LEFT_CHEEK), crop(RIGHT_CHEEK), crop(T_ZONE)
    cheeks = [c for c in (l_cheek, r_cheek) if c is not None]

    # 1. Acne-like spots and redness (cheeks + forehead)
    acne_count = 0
    red_pixels = 0
    total_pixels = 0
    for region in (l_cheek, r_cheek, forehead):
        if region is None:
            continue
        hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
        red = cv2.bitwise_or(
            cv2.inRange(hsv, np.array([0, 50, 40]), np.array([12, 255, 255])),
            cv2.inRange(hsv, np.array([168, 50, 40]), np.array([180, 255, 255])),
        )
        contours, _ = cv2.findContours(red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if 3 <= area <= 150:
                perimeter = cv2.arcLength(c, True)
                if perimeter > 0 and 4 * np.pi * area / (perimeter * perimeter) > 0.35:
                    acne_count += 1
        red_pixels += cv2.countNonZero(red)
        total_pixels += region.shape[0] * region.shape[1]
    if total_pixels == 0:
        raise ImageRejected("Facial skin regions could not be isolated. Please face the camera directly.")
    redness = min(100, int((red_pixels / total_pixels * 100) * 1.5))

    # 2. Local dark-spot contrast (pigmentation indicator)
    pigment_pixels = 0
    for region in cheeks:
        g = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        diff = cv2.subtract(cv2.GaussianBlur(g, (21, 21), 0), g)
        _, th = cv2.threshold(diff, 12, 255, cv2.THRESH_BINARY)
        pigment_pixels += cv2.countNonZero(th)
    pigmentation = min(100, int((pigment_pixels / total_pixels * 100) * 3))

    # 3. Texture variance of cheeks (dryness indicator) — None when cheeks are not visible
    dryness: Optional[int] = None
    if cheeks:
        variance = float(np.mean([cv2.Laplacian(cv2.cvtColor(c, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() for c in cheeks]))
        dryness = min(100, max(0, int(variance / 12)))

    # 4. Forehead edge density (line indicator)
    wrinkles = 0
    if forehead is not None:
        fg = cv2.cvtColor(forehead, cv2.COLOR_BGR2GRAY)
        wrinkles = min(100, int((cv2.countNonZero(cv2.Canny(fg, 25, 65)) / fg.size) * 150))

    # 5. Specular highlights in the T-zone (oiliness indicator)
    oiliness = 0
    if t_zone is not None:
        tg = cv2.cvtColor(t_zone, cv2.COLOR_BGR2GRAY)
        _, hot = cv2.threshold(tg, 220, 255, cv2.THRESH_BINARY)
        oiliness = min(100, int((cv2.countNonZero(hot) / tg.size) * 100 * 2.5))

    # 6. Colour uniformity between cheeks — None unless both cheeks were measured
    uniformity: Optional[int] = None
    if len(cheeks) == 2:
        std = float(np.std([cv2.mean(c)[:3] for c in cheeks]))
        uniformity = max(30, min(100, int(100 - std * 3)))

    skin_score = max(
        30,
        int(100 - min(30, acne_count * 3) - min(20, redness * 0.4) - min(20, pigmentation * 0.5) - min(15, wrinkles * 0.4)),
    )
    hydration = None if dryness is None else max(20, 100 - dryness)
    acne_severity = min(100, acne_count * 8)

    findings: List[str] = []
    recs: List[str] = []
    if acne_count > 8:
        findings.append(f"{acne_count} acne-like spots detected (small reddish circular regions).")
        recs.append("Consider a salicylic-acid cleanser or spot treatment; see a dermatologist if breakouts persist.")
    elif acne_count > 2:
        findings.append(f"{acne_count} acne-like spots detected.")
        recs.append("Keep skin clean, avoid picking spots, and use non-comedogenic products.")
    else:
        findings.append(f"Few acne-like spots detected ({acne_count}).")
    if redness > 40:
        findings.append(f"Elevated share of red-hued pixels in cheek/forehead regions ({redness}/100).")
        recs.append("Soothing ingredients such as centella or ceramides may help; avoid harsh exfoliation.")
    if pigmentation > 30:
        findings.append(f"Local dark-spot contrast indicator is elevated ({pigmentation}/100).")
        recs.append("Daily broad-spectrum SPF 50 and a vitamin C or niacinamide serum are commonly recommended.")
    if wrinkles > 30:
        findings.append(f"Forehead line-density indicator is elevated ({wrinkles}/100).")
        recs.append("A gentle retinoid or peptide product at night and daily SPF support skin elasticity.")
    if dryness is None:
        findings.append("Cheek texture could not be measured (cheeks not clearly visible).")
    elif dryness > 50:
        findings.append(f"Cheek texture variance suggests possible roughness or dryness ({dryness}/100).")
        recs.append("A hydrating serum followed by a barrier cream can help with rough texture.")
    if oiliness > 25:
        findings.append(f"Bright specular highlights in the T-zone ({oiliness}/100), which can indicate shine.")
        recs.append("Oil-free, non-comedogenic moisturisers and a weekly clay mask may help with shine.")
    if not recs:
        recs = ["Keep a gentle cleanser, moisturiser and daily broad-spectrum SPF."]

    parts = [f"Image-based skin score {skin_score}/100 from spot, redness, pigment-contrast and line indicators"]
    parts.append(f"{acne_count} acne-like spots")
    parts.append(f"texture hydration index {hydration}/100" if hydration is not None else "texture not measurable")
    summary = "; ".join(parts) + ". These are photo-based indicators, not a clinical assessment."

    return SkinAnalysisResponse(
        engineVersion=ENGINE_VERSION,
        skinScore=skin_score,
        hydrationScore=hydration,
        acneSeverity=acne_severity,
        confidence=None,
        metrics=SkinMetrics(
            acneCount=acne_count,
            rednessScore=redness,
            pigmentationScore=pigmentation,
            wrinkleScore=wrinkles,
            drynessScore=dryness,
            oilinessScore=oiliness,
            skinUniformityScore=uniformity,
        ),
        findings=findings,
        recommendations=recs,
        summary=summary,
        quality=SkinQuality(width=w, height=h, blurScore=round(blur, 2), brightness=round(light, 2)),
    )
