from fastapi import APIRouter, Depends

from app.config import Settings
from app.dependencies import get_app_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_app_settings)) -> HealthResponse:
    # ai_configured is a boolean only; the key itself is never exposed.
    return HealthResponse(status="ok", ai_configured=settings.ai_configured)
