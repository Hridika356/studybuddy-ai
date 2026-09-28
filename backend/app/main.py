"""FastAPI application factory."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.db import Database, DocumentRepository
from app.errors import register_error_handlers
from app.routes import ask, documents, health, quiz
from app.schemas.common import ErrorResponse
from app.services.claude_service import ClaudeService
from app.services.document_service import DocumentService
from app.services.storage_service import StorageService
from app.utils.rate_limit import RateLimiter

logger = logging.getLogger("app")


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    # The SDK's HTTP client logs request URLs at INFO; keep it quiet unless debugging.
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def create_app(settings: Settings | None = None, claude_client: Any | None = None) -> FastAPI:
    """Build the app. Tests pass custom settings and a fake Claude client."""
    settings = settings or get_settings()
    _configure_logging(settings.log_level)

    database = Database(settings.database_path)
    database.initialize()
    storage = StorageService(settings.upload_dir)
    storage.initialize()

    app = FastAPI(
        title="StudyBuddy AI API",
        version="1.0.0",
        description="Upload lecture PDFs, ask cited questions, and generate practice quizzes.",
    )
    app.state.settings = settings
    app.state.document_service = DocumentService(settings, DocumentRepository(database), storage)
    app.state.claude_service = ClaudeService(settings, client=claude_client)
    app.state.ai_rate_limiter = RateLimiter(
        settings.rate_limit_requests, settings.rate_limit_window_seconds
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    register_error_handlers(app)

    # Documents the shared {"error": {...}} shape for every non-2xx response in /docs.
    error_responses = {"4XX": {"model": ErrorResponse}, "5XX": {"model": ErrorResponse}}
    for router in (health.router, documents.router, ask.router, quiz.router):
        app.include_router(router, responses=error_responses)

    if not settings.ai_configured and claude_client is None:
        logger.warning("ANTHROPIC_API_KEY is not set: /ask and /quiz will return 503")
    logger.info(
        "StudyBuddy API ready (model=%s, origins=%s)",
        settings.anthropic_model,
        settings.allowed_origins,
    )
    return app


app = create_app()
