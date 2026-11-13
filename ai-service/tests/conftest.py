import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app

TOKEN = "t" * 40


def settings(token: str | None = TOKEN, app_env: str = "test") -> Settings:
    return Settings(
        app_env=app_env,
        token=token,
        max_upload_bytes=10 * 1024 * 1024,
        min_dimension=320,
        max_dimension=8192,
        max_pixels=40_000_000,
    )


@pytest.fixture()
def client() -> TestClient:
    return TestClient(create_app(settings()))


@pytest.fixture()
def auth() -> dict:
    return {"Authorization": f"Bearer {TOKEN}"}


def encode(img: np.ndarray, ext: str = ".png") -> bytes:
    ok, buf = cv2.imencode(ext, img)
    assert ok
    return buf.tobytes()


def noise_image(w: int = 640, h: int = 640, seed: int = 1) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.integers(0, 256, size=(h, w, 3), dtype=np.uint8)
