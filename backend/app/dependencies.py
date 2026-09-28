"""FastAPI dependency providers.

Services are created once in main.create_app and kept on app.state.
"""

from __future__ import annotations

from fastapi import Request

from app.config import Settings
from app.services.claude_service import ClaudeService
from app.services.document_service import DocumentService
from app.utils.rate_limit import RateLimiter, client_key


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_document_service(request: Request) -> DocumentService:
    return request.app.state.document_service


def get_claude_service(request: Request) -> ClaudeService:
    return request.app.state.claude_service


class AiRateLimit:
    """Call `.check()` inside a route once cheap validation has passed, so bad input
    (typos, unknown doc_id) doesn't consume a user's AI request quota."""

    def __init__(self, request: Request):
        self._request = request

    def check(self) -> None:
        limiter: RateLimiter = self._request.app.state.ai_rate_limiter
        limiter.check(client_key(self._request))
