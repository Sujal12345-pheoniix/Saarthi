"""HTTP routes. Analysis endpoints accept image BYTES only (multipart field `image`)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import JSONResponse

from app.schemas.analysis import FitnessAnalysisResponse, SkinAnalysisResponse
from app.security.auth import require_service_token
from app.services.fitness import analyze_posture
from app.services.image_io import ImageRejected, decode_image
from app.services.skin import analyze_skin

router = APIRouter()


@router.get("/")
@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "saarthi-ai"}


async def _read_upload(request: Request, image: UploadFile) -> bytes:
    limit = request.app.state.settings.max_upload_bytes
    data = await image.read(limit + 1)
    if len(data) > limit:
        raise ImageRejected("The image exceeds the maximum upload size.", 413)
    return data


@router.post("/v1/analyze/skin", response_model=SkinAnalysisResponse, dependencies=[Depends(require_service_token)])
async def skin(request: Request, image: UploadFile = File(...)) -> SkinAnalysisResponse:
    img = decode_image(await _read_upload(request, image), request.app.state.settings)
    return analyze_skin(img)


@router.post("/v1/analyze/fitness", response_model=FitnessAnalysisResponse, dependencies=[Depends(require_service_token)])
async def fitness(request: Request, image: UploadFile = File(...)) -> FitnessAnalysisResponse:
    img = decode_image(await _read_upload(request, image), request.app.state.settings)
    return analyze_posture(img)


@router.post("/analyze-skin")
@router.post("/analyze-fitness")
async def removed_url_endpoints() -> JSONResponse:
    """Pre-Phase-1 endpoints fetched arbitrary image URLs (SSRF). They are permanently removed."""
    return JSONResponse(
        status_code=410,
        content={"detail": "This endpoint accepted image URLs and has been removed. POST image bytes to /v1/analyze/{skin|fitness}."},
    )
