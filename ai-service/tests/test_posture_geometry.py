"""Geometry helpers behind the posture scores (regression for the posture-cv@1 orientation bug)."""

from types import SimpleNamespace as P

import pytest

from app.schemas.analysis import FitnessAnalysisResponse
from app.services.fitness import forward_angle, line_tilt


def test_level_line_is_zero_regardless_of_landmark_order():
    # Subject's left shoulder appears on the image RIGHT when facing the camera.
    left_shoulder, right_shoulder = P(x=0.6, y=0.3), P(x=0.4, y=0.3)
    assert line_tilt(left_shoulder, right_shoulder) == pytest.approx(0.0)
    assert line_tilt(right_shoulder, left_shoulder) == pytest.approx(0.0)


def test_tilt_magnitude_is_symmetric():
    a, b = P(x=0.6, y=0.30), P(x=0.4, y=0.31)
    assert line_tilt(a, b) == pytest.approx(line_tilt(b, a))
    assert 2.5 < line_tilt(a, b) < 3.0


def test_upright_head_has_zero_forward_angle():
    ear, shoulder = P(x=0.5, y=0.2), P(x=0.5, y=0.35)
    assert forward_angle(ear, shoulder) == pytest.approx(0.0)


def test_forward_head_angle():
    ear, shoulder = P(x=0.53, y=0.2), P(x=0.5, y=0.35)
    assert 10 < forward_angle(ear, shoulder) < 12


def test_mobility_is_never_fabricated():
    # The contract allows mobility only as null for single-photo analysis.
    field = FitnessAnalysisResponse.model_fields["mobilityScore"]
    assert field.is_required() is True  # must be explicitly provided (None), never silently defaulted
