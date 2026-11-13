"""Shared-secret bearer authentication for service-to-service calls."""

from __future__ import annotations

import hmac
import logging

from fastapi import Header, HTTPException, Request, status

log = logging.getLogger("saarthi.ai.auth")


async def require_service_token(request: Request, authorization: str | None = Header(default=None)) -> None:
    settings = request.app.state.settings
    expected: str | None = settings.token
    if expected is None:
        # Only reachable in development (load_settings refuses to start otherwise).
        log.warning("AI_SERVICE_TOKEN not set: accepting unauthenticated request (development only)")
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    supplied = authorization[len("Bearer ") :]
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")
