"""FastAPI application factory for the Saarthi CV service.

Run:  uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import Settings, load_settings
from app.services.image_io import ImageRejected

logging.basicConfig(level=logging.INFO, format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')
log = logging.getLogger("saarthi.ai")

MULTIPART_OVERHEAD = 64 * 1024


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    app = FastAPI(
        title="Saarthi CV Service",
        # Interactive docs are disabled outside development.
        docs_url=None if settings.strict else "/docs",
        redoc_url=None,
        openapi_url=None if settings.strict else "/openapi.json",
    )
    app.state.settings = settings

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        declared = request.headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > settings.max_upload_bytes + MULTIPART_OVERHEAD:
            return JSONResponse(status_code=413, content={"detail": "Request body too large."})
        return await call_next(request)

    @app.exception_handler(ImageRejected)
    async def rejected(_request: Request, exc: ImageRejected):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def invalid(_request: Request, _exc: RequestValidationError):
        # Do not echo submitted content back.
        return JSONResponse(status_code=400, content={"detail": "Invalid request. Send multipart/form-data with an 'image' file."})

    @app.exception_handler(Exception)
    async def unhandled(_request: Request, exc: Exception):
        log.exception("unhandled error: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Internal error."})

    app.include_router(router)
    log.info("starting app_env=%s auth=%s", settings.app_env, "enabled" if settings.token else "DISABLED (development)")
    return app


app = create_app()
