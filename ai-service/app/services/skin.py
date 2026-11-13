"""Photo-based skin visual indicators (OpenCV + MediaPipe Face Mesh) — engine skin-cv@3.

What this engine is: a set of transparent image measurements over facial regions of ONE photo.
What it is not: a dermatological assessment. It names no condition, measures no hydration or oil production,
and has not been validated against clinician labels (docs/ai/SKIN_ENGINE.md, docs/ai/EVALUATION.md).

Coordinate system: MediaPipe Face Mesh landmarks are normalised image coordinates (origin top-left, x right,
y down). They are converted to PIXEL coordinates before any geometry so that angles are correct for non-square
images. Regions are convex hulls of landmark subsets, eroded by a few pixels so hull borders do not count as
texture or edges.

Pipeline
  1. Decode + size/dimension checks (image_io.decode_image)
  2. Quality gates: resolution >= 480 px, sharpness >= 60, mean brightness 40..240
  3. Face Mesh: exactly one face; face bbox >= 4% of the image; eye-line roll <= 20 degrees;
     highlight clipping inside the face hull <= 15%
  4. Region masks: forehead, left cheek, right cheek, T-zone, chin
  5. Measurements (each documented in MEASUREMENT_SPECS below)
  6. Observations (visible characteristics) are separated from interpretations (hedged possibilities)

Changes from skin-cv@2: polygon (hull) region masks instead of bounding rectangles; chin region; spot-size limits
scale with face size; face size / roll / face-clipping gates; cheek colour similarity uses CIE L*a*b* delta-E
(v2 took the standard deviation across colour CHANNELS, which mostly measured skin hue, not cheek similarity);
hydrationScore and acneSeverity are no longer produced (a photo measures neither); no named active ingredients
in recommendations; the composite has no artificial floor of 30.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import mediapipe as mp
import numpy as np

from app.schemas.analysis import (
    ImageQuality,
    Interpretation,
    Measurement,
    Observation,
    SkinAnalysisResponse,
    SkinMetrics,
    SkinQuality,
)
from app.services.image_io import ImageRejected, blur_score, brightness
from app.services.quality import clip_percentages, quality_limitations, quality_score

ENGINE_VERSION = "skin-cv@3"

# MediaPipe Face Mesh landmark subsets (canonical 468-point topology).
FOREHEAD = [67, 109, 10, 338, 297, 299, 9, 69]
LEFT_CHEEK = [50, 123, 147, 187, 205, 137]
RIGHT_CHEEK = [280, 352, 376, 409, 425, 366]
T_ZONE = [168, 6, 197, 195, 5, 4, 1, 19, 94]
CHIN = [18, 200, 199, 175, 152, 148, 176, 377, 400]
EYE_OUTER_RIGHT, EYE_OUTER_LEFT = 33, 263  # subject's right eye (image left), subject's left eye (image right)

# Quality gates (uncalibrated; see docs/ai/SKIN_ENGINE.md).
MIN_SIDE_PX = 480
MIN_BLUR = 60.0
MIN_BRIGHTNESS, MAX_BRIGHTNESS = 40.0, 240.0
MIN_FACE_AREA_PCT = 4.0
MAX_ROLL_DEG = 20.0
MAX_FACE_HIGHLIGHT_CLIP_PCT = 15.0

# Observation thresholds (carried over from skin-cv@2 where applicable; uncalibrated).
SPOTS_SOME, SPOTS_MANY = 2, 8
REDNESS_HIGH = 40
DARK_SPOT_HIGH = 30
LINE_DENSITY_HIGH = 30
TEXTURE_HIGH = 50
SPECULAR_HIGH = 25
UNIFORMITY_LOW = 70

REFERENCE_FACE_WIDTH_PX = 300.0

COMPOSITE_FORMULA = (
    "skinScore = clamp(round(100 - min(30, 3 x reddishSpotCount) - min(20, 0.4 x rednessIndex) "
    "- min(20, 0.5 x darkSpotContrastIndex) - min(15, 0.4 x lineEdgeDensityIndex)), 0, 100). "
    "An image-indicator composite: higher means fewer pronounced visual indicators in this photo. "
    "It is not a measure of skin health and is comparable only between photos analysed by skin-cv@3."
)

ENGINE_LIMITATIONS = [
    "These are image heuristics with uncalibrated thresholds. They have not been validated against "
    "dermatologist labels, so no accuracy can be stated.",
    "Colour-based measurements (redness, dark-spot contrast, cheek colour similarity) depend on lighting, "
    "white balance, camera processing, makeup and skin tone. Performance across skin tones has not been evaluated.",
    "A single photo cannot measure hydration, oil production or skin health, and no skin condition is identified.",
    "Region boundaries come from MediaPipe Face Mesh landmarks and can include hair, eyebrows, stubble or shadows.",
    "For comparisons over time, use the same camera, distance and lighting, without makeup.",
]

BASE_RECOMMENDATIONS = [
    "Use a gentle cleanser and a moisturiser suited to your skin, and apply a broad-spectrum sunscreen when outdoors.",
    "For tracking over time, take photos in the same lighting, at the same distance and with the same camera, without makeup.",
]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def roll_angle(p_right_eye: Tuple[float, float], p_left_eye: Tuple[float, float]) -> float:
    """Tilt of the eye line from horizontal in degrees, [0, 90], independent of point order (pixel coords)."""
    t = abs(math.degrees(math.atan2(p_left_eye[1] - p_right_eye[1], p_left_eye[0] - p_right_eye[0])))
    return min(t, 180.0 - t)


@dataclass
class Region:
    name: str
    crop: np.ndarray  # BGR crop of the region's bounding rectangle
    mask: np.ndarray  # uint8 mask (255 inside the eroded hull) aligned with `crop`

    @property
    def pixels(self) -> int:
        return int(np.count_nonzero(self.mask))


def region_from_points(img: np.ndarray, pts: np.ndarray, name: str, erode_px: int = 3) -> Optional[Region]:
    """Convex-hull region of pixel points. Returns None when the region is too small to measure."""
    h, w = img.shape[:2]
    pts = pts.astype(np.int32)
    x, y, rw, rh = cv2.boundingRect(pts)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + rw), min(h, y + rh)
    if x1 - x0 <= 10 or y1 - y0 <= 10:
        return None
    mask = np.zeros((y1 - y0, x1 - x0), dtype=np.uint8)
    hull = cv2.convexHull(pts - np.array([x0, y0], dtype=np.int32))
    cv2.fillConvexPoly(mask, hull, 255)
    if erode_px > 0:
        mask = cv2.erode(mask, np.ones((2 * erode_px + 1, 2 * erode_px + 1), np.uint8))
    if np.count_nonzero(mask) < 100:
        return None
    return Region(name=name, crop=img[y0:y1, x0:x1], mask=mask)


# ───────────────────────────── Measurement primitives (unit-tested) ─────────────────────────────


def red_hue_mask(crop: np.ndarray) -> np.ndarray:
    """Pixels whose HSV hue is red (0-12 or 168-180), saturation >= 50 and value >= 40."""
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    return cv2.bitwise_or(
        cv2.inRange(hsv, np.array([0, 50, 40]), np.array([12, 255, 255])),
        cv2.inRange(hsv, np.array([168, 50, 40]), np.array([180, 255, 255])),
    )


def count_spot_like(region: Region, min_area: float, max_area: float, min_circularity: float = 0.35) -> Tuple[int, int]:
    """Count small, roughly circular red-hue blobs inside the region. Returns (count, red_pixel_count)."""
    red = cv2.bitwise_and(red_hue_mask(region.crop), region.mask)
    contours, _ = cv2.findContours(red, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = 0
    for c in contours:
        area = cv2.contourArea(c)
        if min_area <= area <= max_area:
            perimeter = cv2.arcLength(c, True)
            if perimeter > 0 and 4 * math.pi * area / (perimeter * perimeter) > min_circularity:
                count += 1
    return count, int(np.count_nonzero(red))


def dark_spot_pixels(region: Region, threshold: int = 12) -> int:
    """Pixels at least `threshold` grey levels darker than their 21x21 Gaussian-blurred neighbourhood."""
    g = cv2.cvtColor(region.crop, cv2.COLOR_BGR2GRAY)
    diff = cv2.subtract(cv2.GaussianBlur(g, (21, 21), 0), g)
    _, th = cv2.threshold(diff, threshold, 255, cv2.THRESH_BINARY)
    return int(np.count_nonzero(cv2.bitwise_and(th, region.mask)))


def texture_variance(region: Region) -> float:
    """Variance of the Laplacian over the region's pixels."""
    lap = cv2.Laplacian(cv2.cvtColor(region.crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F)
    vals = lap[region.mask > 0]
    return float(vals.var()) if vals.size else 0.0


def edge_density(region: Region) -> float:
    """Share (0-1) of region pixels that are Canny edges (thresholds 25/65)."""
    edges = cv2.Canny(cv2.cvtColor(region.crop, cv2.COLOR_BGR2GRAY), 25, 65)
    n = region.pixels
    return float(np.count_nonzero(cv2.bitwise_and(edges, region.mask))) / n if n else 0.0


def specular_share(region: Region, level: int = 220) -> float:
    """Share (0-1) of region pixels with grey level >= `level`."""
    g = cv2.cvtColor(region.crop, cv2.COLOR_BGR2GRAY)
    n = region.pixels
    return float(np.count_nonzero((g >= level) & (region.mask > 0))) / n if n else 0.0


def mean_lab(region: Region) -> np.ndarray:
    """Mean CIE L*a*b* colour (L 0-100) of the region."""
    lab = cv2.cvtColor(region.crop.astype(np.float32) / 255.0, cv2.COLOR_BGR2Lab)
    return lab[region.mask > 0].mean(axis=0)


def delta_e76(lab1: np.ndarray, lab2: np.ndarray) -> float:
    return float(np.linalg.norm(np.asarray(lab1, dtype=np.float64) - np.asarray(lab2, dtype=np.float64)))


# ───────────────────────────── Values → report (pure, unit-tested) ─────────────────────────────


@dataclass
class SkinValues:
    reddish_spot_count: int
    redness_index: int
    dark_spot_contrast_index: int
    line_edge_density_index: Optional[int]
    texture_index: Optional[int]
    specular_highlight_index: Optional[int]
    tone_uniformity_index: Optional[int]
    cheek_delta_e: Optional[float]
    regions: List[str] = field(default_factory=list)
    roll_deg: float = 0.0


def composite_score(v: SkinValues) -> int:
    line = v.line_edge_density_index or 0
    return int(
        _clamp(
            round(
                100
                - min(30, 3 * v.reddish_spot_count)
                - min(20, 0.4 * v.redness_index)
                - min(20, 0.5 * v.dark_spot_contrast_index)
                - min(15, 0.4 * line)
            ),
            0,
            100,
        )
    )


def _m(key, label, value, unit, higher_is, source, method, explanation, limitations) -> Measurement:
    return Measurement(
        key=key,
        label=label,
        value=None if value is None else float(value),
        unit=unit,
        higherIs=higher_is,
        source=source,
        method=method,
        explanation=explanation,
        limitations=limitations,
    )


def build_measurements(v: SkinValues) -> List[Measurement]:
    regions = ",".join(v.regions)
    return [
        _m(
            "reddishSpotCount", "Reddish spot-like regions", v.reddish_spot_count, "count", "more_pronounced",
            f"opencv:hsv-red-mask+contours@{regions}",
            "Contours of red-hue pixels (HSV hue 0-12 or 168-180, S>=50, V>=40) whose area lies within a range "
            "scaled to face width and whose circularity 4*pi*A/P^2 exceeds 0.35.",
            "Counts small, roughly round reddish areas visible in the photo.",
            ["Freckles, moles, makeup, lighting and image noise can be counted.", "Not a count of any skin condition."],
        ),
        _m(
            "rednessIndex", "Redness index", v.redness_index, "index_0_100", "more_pronounced",
            f"opencv:hsv-red-mask@{regions}",
            "min(100, 1.5 x percentage of region pixels with red hue).",
            "How much of the measured skin area has a red hue in this photo.",
            ["Strongly affected by white balance, warm lighting and skin tone."],
        ),
        _m(
            "darkSpotContrastIndex", "Local dark-spot contrast", v.dark_spot_contrast_index, "index_0_100",
            "more_pronounced", "opencv:gaussian-local-contrast@cheeks",
            "min(100, 3 x percentage of cheek pixels at least 12 grey levels darker than their 21x21 blurred surroundings).",
            "How much of the cheek area is noticeably darker than its immediate surroundings.",
            ["Shadows, pores, hair and freckles contribute.", "Not a pigmentation assessment."],
        ),
        _m(
            "lineEdgeDensityIndex", "Forehead line-like edge density", v.line_edge_density_index, "index_0_100",
            "more_pronounced", "opencv:canny(25,65)@forehead",
            "min(100, 150 x share of forehead pixels detected as Canny edges).",
            "How many fine line-like edges appear on the forehead in this photo.",
            ["Expression, hair, eyebrows and shadows add edges.", "Not an age or skin-ageing estimate."],
        ),
        _m(
            "textureIndex", "Cheek surface texture index", v.texture_index, "index_0_100", "more_pronounced",
            "opencv:laplacian-variance@cheeks",
            "min(100, variance of the Laplacian over cheek pixels / 12), averaged over visible cheeks.",
            "How much fine visual texture the cheeks show in this photo.",
            ["Depends strongly on camera sharpness, noise and resolution.", "Does not measure hydration or dryness."],
        ),
        _m(
            "specularHighlightIndex", "T-zone specular highlights", v.specular_highlight_index, "index_0_100",
            "more_pronounced", "opencv:grey>=220@t-zone",
            "min(100, 2.5 x percentage of T-zone pixels with grey level >= 220).",
            "How much of the T-zone shows bright reflections in this photo.",
            ["Depends on light position and intensity.", "Does not measure oil production."],
        ),
        _m(
            "toneUniformityIndex", "Cheek colour similarity", v.tone_uniformity_index, "index_0_100", "neutral",
            "opencv:cie-lab-delta-e76@left-cheek,right-cheek",
            "clamp(100 - 5 x deltaE76 between the mean L*a*b* colours of the two cheeks, 0, 100).",
            "How similar the average colour of the two cheeks is in this photo.",
            ["Uneven or side lighting is the most common cause of a difference."],
        ),
    ]


def build_observations(v: SkinValues) -> List[Observation]:
    obs: List[Observation] = []
    n = v.reddish_spot_count
    if n > SPOTS_MANY:
        obs.append(Observation(key="spots", text=f"{n} reddish spot-like regions are visible in the measured areas.", measurementKeys=["reddishSpotCount"]))
    elif n > SPOTS_SOME:
        obs.append(Observation(key="spots", text=f"A few reddish spot-like regions ({n}) are visible.", measurementKeys=["reddishSpotCount"]))
    else:
        obs.append(Observation(key="spots", text=f"Few reddish spot-like regions were found ({n}).", measurementKeys=["reddishSpotCount"]))
    if v.redness_index > REDNESS_HIGH:
        obs.append(Observation(key="redness", text=f"A relatively high share of red-hued skin pixels (index {v.redness_index}/100).", measurementKeys=["rednessIndex"]))
    if v.dark_spot_contrast_index > DARK_SPOT_HIGH:
        obs.append(Observation(key="darkSpots", text=f"Areas of local dark-spot contrast on the cheeks (index {v.dark_spot_contrast_index}/100).", measurementKeys=["darkSpotContrastIndex"]))
    if v.line_edge_density_index is not None and v.line_edge_density_index > LINE_DENSITY_HIGH:
        obs.append(Observation(key="lines", text=f"Elevated line-like edge density on the forehead (index {v.line_edge_density_index}/100).", measurementKeys=["lineEdgeDensityIndex"]))
    if v.texture_index is None:
        obs.append(Observation(key="texture", text="Cheek texture could not be measured because the cheeks were not clearly visible.", measurementKeys=["textureIndex"]))
    elif v.texture_index > TEXTURE_HIGH:
        obs.append(Observation(key="texture", text=f"Pronounced fine visual texture on the cheeks (index {v.texture_index}/100).", measurementKeys=["textureIndex"]))
    if v.specular_highlight_index is not None and v.specular_highlight_index > SPECULAR_HIGH:
        obs.append(Observation(key="highlights", text=f"Bright specular highlights in the T-zone (index {v.specular_highlight_index}/100).", measurementKeys=["specularHighlightIndex"]))
    if v.tone_uniformity_index is not None and v.tone_uniformity_index < UNIFORMITY_LOW:
        obs.append(Observation(key="tone", text=f"The two cheeks differ in average colour (similarity {v.tone_uniformity_index}/100).", measurementKeys=["toneUniformityIndex"]))
    return obs


INTERPRETATIONS: Dict[str, Interpretation] = {
    "spots": Interpretation(
        text="Small reddish spot-like regions can be associated with blemishes or irritation, but can also come from freckles, moles, makeup, lighting or image noise.",
        measurementKeys=["reddishSpotCount"],
        caveat="A photo cannot tell what a spot is. A dermatologist or other qualified professional can.",
    ),
    "redness": Interpretation(
        text="A higher share of red-hued pixels may reflect flushing, warmth, recent exercise, irritation, or the camera's colour processing.",
        measurementKeys=["rednessIndex"],
        caveat="Strongly affected by lighting and white balance; compare only photos taken in the same conditions.",
    ),
    "darkSpots": Interpretation(
        text="Local dark-spot contrast may correspond to freckles, sun-related spots, marks, pores or shadows.",
        measurementKeys=["darkSpotContrastIndex"],
        caveat="Any spot that changes in size, shape or colour, bleeds or itches should be checked by a professional.",
    ),
    "lines": Interpretation(
        text="Line-like edges on the forehead may reflect expression lines, surface texture, hair or shadows.",
        measurementKeys=["lineEdgeDensityIndex"],
        caveat="Facial expression at the moment of the photo has a large effect.",
    ),
    "texture": Interpretation(
        text="Higher cheek texture may reflect visible pores or surface texture, makeup, facial hair or camera noise.",
        measurementKeys=["textureIndex"],
        caveat="This measures visual texture only and does not indicate hydration.",
    ),
    "highlights": Interpretation(
        text="Bright T-zone highlights may reflect surface shine (for example from sweat, natural oils or products) or the position of the light source.",
        measurementKeys=["specularHighlightIndex"],
        caveat="Changing the light direction can change this value substantially.",
    ),
    "tone": Interpretation(
        text="A colour difference between the cheeks most often comes from uneven lighting; it can also reflect real differences in tone.",
        measurementKeys=["toneUniformityIndex"],
        caveat="Face a single, even light source before comparing.",
    ),
}


def build_interpretations(observations: Sequence[Observation], v: SkinValues) -> List[Interpretation]:
    out: List[Interpretation] = []
    for o in observations:
        if o.key == "spots" and v.reddish_spot_count <= SPOTS_SOME:
            continue
        if o.key == "texture" and v.texture_index is None:
            continue
        interp = INTERPRETATIONS.get(o.key)
        if interp is not None:
            out.append(interp)
    return out


def build_recommendations(v: SkinValues) -> List[str]:
    recs = list(BASE_RECOMMENDATIONS)
    if v.reddish_spot_count > SPOTS_SOME:
        recs.append(
            "Avoid picking or squeezing spots. If spots are painful, persistent or spreading, consider seeing a "
            "dermatologist or other qualified professional."
        )
    if v.redness_index > REDNESS_HIGH:
        recs.append(
            "Notice whether redness follows heat, exercise, new products or irritation. If it persists, is painful "
            "or itchy, a qualified professional can assess it."
        )
    if v.dark_spot_contrast_index > DARK_SPOT_HIGH:
        recs.append(
            "Daily broad-spectrum sunscreen helps protect against further sun-related darkening. See a dermatologist "
            "promptly if any spot changes in size, shape or colour, bleeds or itches."
        )
    if v.specular_highlight_index is not None and v.specular_highlight_index > SPECULAR_HIGH:
        recs.append("If shine bothers you, blotting and a lightweight, non-comedogenic moisturiser may help.")
    return recs


def build_summary(v: SkinValues, score: int) -> str:
    parts = [
        f"Photo-based visual indicators from {', '.join(v.regions)}: composite {score}/100 "
        "(higher means fewer pronounced indicators)",
        f"{v.reddish_spot_count} reddish spot-like regions",
        f"redness index {v.redness_index}/100",
    ]
    if v.texture_index is not None:
        parts.append(f"texture index {v.texture_index}/100")
    return "; ".join(parts) + ". These are visual indicators from one photo, not a medical assessment."


def build_legacy_metrics(v: SkinValues) -> SkinMetrics:
    return SkinMetrics(
        acneCount=v.reddish_spot_count,
        rednessScore=v.redness_index,
        pigmentationScore=v.dark_spot_contrast_index,
        wrinkleScore=v.line_edge_density_index,
        drynessScore=v.texture_index,
        oilinessScore=v.specular_highlight_index,
        skinUniformityScore=v.tone_uniformity_index,
    )


# ───────────────────────────── Engine ─────────────────────────────


def _landmarks_px(landmarks, w: int, h: int) -> np.ndarray:
    return np.array([(lm.x * w, lm.y * h) for lm in landmarks], dtype=np.float64)


def measure_regions(img: np.ndarray, pts: np.ndarray, face_width_px: float) -> SkinValues:
    regions = {
        "forehead": region_from_points(img, pts[FOREHEAD], "forehead"),
        "left cheek": region_from_points(img, pts[LEFT_CHEEK], "left cheek"),
        "right cheek": region_from_points(img, pts[RIGHT_CHEEK], "right cheek"),
        "T-zone": region_from_points(img, pts[T_ZONE], "T-zone", erode_px=1),
        "chin": region_from_points(img, pts[CHIN], "chin"),
    }
    forehead = regions["forehead"]
    cheeks = [r for r in (regions["left cheek"], regions["right cheek"]) if r is not None]
    if forehead is None or not cheeks:
        raise ImageRejected("Facial skin regions could not be isolated. Please face the camera directly with your forehead visible.")

    scale = (face_width_px / REFERENCE_FACE_WIDTH_PX) ** 2
    min_area, max_area = max(3.0, 3.0 * scale), max(10.0, 150.0 * scale)

    spot_regions = [r for r in (forehead, *cheeks, regions["chin"]) if r is not None]
    spots = 0
    red_px = 0
    total_px = 0
    for r in spot_regions:
        c, red = count_spot_like(r, min_area, max_area)
        spots += c
        red_px += red
        total_px += r.pixels
    redness = int(min(100, (red_px / total_px * 100) * 1.5))

    cheek_px = sum(r.pixels for r in cheeks)
    dark = int(min(100, (sum(dark_spot_pixels(r) for r in cheeks) / cheek_px * 100) * 3))
    texture = int(_clamp(np.mean([texture_variance(r) for r in cheeks]) / 12, 0, 100))
    lines = int(min(100, edge_density(forehead) * 150))
    t_zone = regions["T-zone"]
    specular = int(min(100, specular_share(t_zone) * 100 * 2.5)) if t_zone is not None else None

    uniformity: Optional[int] = None
    de: Optional[float] = None
    if len(cheeks) == 2:
        de = delta_e76(mean_lab(cheeks[0]), mean_lab(cheeks[1]))
        uniformity = int(_clamp(round(100 - 5 * de), 0, 100))

    return SkinValues(
        reddish_spot_count=spots,
        redness_index=redness,
        dark_spot_contrast_index=dark,
        line_edge_density_index=lines,
        texture_index=texture,
        specular_highlight_index=specular,
        tone_uniformity_index=uniformity,
        cheek_delta_e=None if de is None else round(de, 2),
        regions=[name for name, r in regions.items() if r is not None],
    )


def analyze_skin(img: np.ndarray) -> SkinAnalysisResponse:
    h, w = img.shape[:2]
    if w < MIN_SIDE_PX or h < MIN_SIDE_PX:
        raise ImageRejected(f"Resolution below threshold. Please upload an image of at least {MIN_SIDE_PX}x{MIN_SIDE_PX} pixels.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = blur_score(gray)
    if blur < MIN_BLUR:
        raise ImageRejected(f"Image too blurry (sharpness {blur:.1f}). Please upload a sharp, well-focused photo.")
    light = brightness(gray)
    if light < MIN_BRIGHTNESS:
        raise ImageRejected("Low lighting detected. Please capture the photo in a well-lit environment.")
    if light > MAX_BRIGHTNESS:
        raise ImageRejected("Overexposed photo detected. Please avoid direct harsh light.")

    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=2, refine_landmarks=True) as mesh:
        results = mesh.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        raise ImageRejected("Face not visible. Please position your face clearly in front of the camera.")
    if len(results.multi_face_landmarks) > 1:
        raise ImageRejected("Multiple faces detected. Please make sure only one person is in the frame.")

    pts = _landmarks_px(results.multi_face_landmarks[0].landmark, w, h)
    fx0, fy0 = np.clip(pts.min(axis=0), 0, [w, h])
    fx1, fy1 = np.clip(pts.max(axis=0), 0, [w, h])
    face_w, face_h = float(fx1 - fx0), float(fy1 - fy0)
    face_area_pct = face_w * face_h / (w * h) * 100
    if face_area_pct < MIN_FACE_AREA_PCT:
        raise ImageRejected("Your face is too small in the photo. Please move closer to the camera.")

    roll = roll_angle(tuple(pts[EYE_OUTER_RIGHT]), tuple(pts[EYE_OUTER_LEFT]))
    if roll > MAX_ROLL_DEG:
        raise ImageRejected("Your head is tilted. Please hold the camera level and keep your head upright.")

    face_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillConvexPoly(face_mask, cv2.convexHull(pts.astype(np.int32)), 255)
    hi_clip, lo_clip = clip_percentages(gray, face_mask)
    if hi_clip > MAX_FACE_HIGHLIGHT_CLIP_PCT:
        raise ImageRejected("Too much of your face is overexposed. Please avoid direct light or flash on your face.")

    values = measure_regions(img, pts, face_w)
    values.roll_deg = round(roll, 2)

    q_limits = quality_limitations(blur, light, hi_clip, lo_clip, face_area_pct)
    if roll > 10:
        q_limits.append(f"The head is tilted by about {roll:.0f} degrees; regions may be partly foreshortened.")
    image_quality = ImageQuality(
        passed=True,
        score=quality_score(blur, light, hi_clip, lo_clip, face_area_pct),
        width=w,
        height=h,
        blurScore=round(blur, 2),
        brightness=round(light, 2),
        highlightClipPct=hi_clip,
        shadowClipPct=lo_clip,
        subjectAreaPct=round(min(100.0, face_area_pct), 2),
        limitations=q_limits,
    )

    score = composite_score(values)
    observations = build_observations(values)
    return SkinAnalysisResponse(
        engineVersion=ENGINE_VERSION,
        skinScore=score,
        hydrationScore=None,
        acneSeverity=None,
        confidence=None,
        metrics=build_legacy_metrics(values),
        findings=[o.text for o in observations],
        recommendations=build_recommendations(values),
        summary=build_summary(values, score),
        quality=SkinQuality(width=w, height=h, blurScore=round(blur, 2), brightness=round(light, 2)),
        imageQuality=image_quality,
        measurements=build_measurements(values),
        observations=observations,
        interpretations=build_interpretations(observations, values),
        limitations=list(ENGINE_LIMITATIONS) + q_limits,
        compositeFormula=COMPOSITE_FORMULA,
    )
