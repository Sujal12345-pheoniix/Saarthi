import numpy as np
import pytest

from app.core.config import ConfigError, load_settings
from tests.conftest import encode, noise_image


def files(img_bytes: bytes, name: str = "a.png", mime: str = "image/png"):
    return {"image": (name, img_bytes, mime)}


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok", "service": "saarthi-ai"}


@pytest.mark.parametrize("path", ["/v1/analyze/skin", "/v1/analyze/fitness"])
def test_requires_token(client, path):
    body = files(encode(noise_image()))
    assert client.post(path, files=body).status_code == 401
    assert client.post(path, files=body, headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post(path, files=body, headers={"Authorization": "Basic abc"}).status_code == 401


def test_url_payload_rejected(client, auth):
    """The SSRF vector: the service no longer accepts URLs in any form."""
    res = client.post("/v1/analyze/skin", json={"imageUrl": "http://169.254.169.254/latest/meta-data/"}, headers=auth)
    assert res.status_code == 400
    assert "169.254" not in res.text


@pytest.mark.parametrize("path", ["/analyze-skin", "/analyze-fitness"])
def test_legacy_url_endpoints_are_gone(client, path):
    res = client.post(path, json={"imageUrl": "http://127.0.0.1:8000/"})
    assert res.status_code == 410


def test_rejects_spoofed_content_type(client, auth):
    res = client.post("/v1/analyze/skin", files=files(b"<svg></svg>", "x.png", "image/png"), headers=auth)
    assert res.status_code == 415


def test_rejects_oversized_declared_body(client, auth):
    res = client.post(
        "/v1/analyze/skin",
        content=b"x",
        headers={**auth, "content-type": "multipart/form-data; boundary=x", "content-length": str(50 * 1024 * 1024)},
    )
    assert res.status_code == 413


def test_blurry_image_is_rejected_with_user_safe_reason(client, auth):
    flat = np.full((640, 640, 3), 128, dtype=np.uint8)
    res = client.post("/v1/analyze/skin", files=files(encode(flat)), headers=auth)
    assert res.status_code == 422
    assert "blurry" in res.json()["detail"]


def test_dark_image_is_rejected(client, auth):
    rng = np.random.default_rng(3)
    dark = rng.integers(0, 40, size=(640, 640, 3), dtype=np.uint8)
    res = client.post("/v1/analyze/skin", files=files(encode(dark)), headers=auth)
    assert res.status_code == 422
    assert "light" in res.json()["detail"].lower()


def test_no_face_is_rejected_not_scored(client, auth):
    res = client.post("/v1/analyze/skin", files=files(encode(noise_image(640, 640))), headers=auth)
    assert res.status_code == 422
    assert "Face not visible" in res.json()["detail"]


def test_no_pose_is_rejected_not_scored(client, auth):
    res = client.post("/v1/analyze/fitness", files=files(encode(noise_image(640, 640))), headers=auth)
    assert res.status_code == 422
    assert "pose" in res.json()["detail"].lower()


def test_refuses_to_start_without_token_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("AI_SERVICE_TOKEN", raising=False)
    with pytest.raises(ConfigError):
        load_settings()
    monkeypatch.setenv("AI_SERVICE_TOKEN", "short")
    with pytest.raises(ConfigError):
        load_settings()
    monkeypatch.setenv("AI_SERVICE_TOKEN", "x" * 40)
    assert load_settings().strict is True


def test_docs_disabled_in_production(monkeypatch):
    from app.main import create_app
    from tests.conftest import settings
    from fastapi.testclient import TestClient

    prod = TestClient(create_app(settings(app_env="production")))
    assert prod.get("/docs").status_code == 404
    assert prod.get("/openapi.json").status_code == 404
