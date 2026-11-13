"""Service configuration, read only from this process's environment (never from the web app's .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    app_env: str
    token: str | None
    max_upload_bytes: int
    min_dimension: int
    max_dimension: int
    max_pixels: int

    @property
    def strict(self) -> bool:
        return self.app_env in ("production", "staging")


def load_settings() -> Settings:
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    token = (os.environ.get("AI_SERVICE_TOKEN") or "").strip() or None
    settings = Settings(
        app_env=app_env,
        token=token,
        max_upload_bytes=int(os.environ.get("AI_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024))),
        min_dimension=320,
        max_dimension=8192,
        max_pixels=40_000_000,
    )
    if settings.strict and (not token or len(token) < 32):
        # Refuse to start an unauthenticated inference API outside development.
        raise ConfigError("AI_SERVICE_TOKEN (>= 32 characters) is required when APP_ENV is production or staging")
    return settings
