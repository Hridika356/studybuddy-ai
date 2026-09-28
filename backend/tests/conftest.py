from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from types import SimpleNamespace
from typing import Any

import pytest
from anthropic.types import CitationPageLocation, TextBlock
from fastapi.testclient import TestClient

from app.config import load_settings
from app.main import create_app
from tests.pdf_factory import make_pdf


class FakeMessages:
    """Stands in for client.messages. Queue responses (or exceptions) in order."""

    def __init__(self) -> None:
        self.queue: list[Any] = []
        self.calls: list[dict] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if not self.queue:
            raise AssertionError("Unexpected Claude call: no fake response queued")
        item = self.queue.pop(0)
        if isinstance(item, BaseException):
            raise item
        return item


class FakeClaudeClient:
    def __init__(self) -> None:
        self.messages = FakeMessages()


def text_response(*blocks: TextBlock, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(content=list(blocks), stop_reason=stop_reason)


def cited(text: str, start: int, end: int | None = None) -> TextBlock:
    return TextBlock(
        type="text",
        text=text,
        citations=[
            CitationPageLocation(
                type="page_location",
                cited_text=text,
                document_index=0,
                document_title="notes.pdf",
                start_page_number=start,
                end_page_number=end if end is not None else start + 1,
            )
        ],
    )


def plain(text: str) -> TextBlock:
    return TextBlock(type="text", text=text, citations=None)


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    base = load_settings()
    return replace(
        base,
        anthropic_api_key=None,
        upload_dir=tmp_path / "uploads",
        database_path=tmp_path / "data" / "test.db",
        max_pdf_size_mb=1,
        max_pdf_pages=10,
        max_question_length=200,
        rate_limit_requests=100,
        allowed_origins=["http://localhost:5173"],
    )


@pytest.fixture
def fake_claude() -> FakeClaudeClient:
    return FakeClaudeClient()


@pytest.fixture
def app_factory(settings, fake_claude) -> Callable[..., TestClient]:
    def build(**overrides: Any) -> TestClient:
        client = overrides.pop("claude_client", fake_claude)
        app = create_app(replace(settings, **overrides), claude_client=client)
        return TestClient(app)

    return build


@pytest.fixture
def client(app_factory) -> TestClient:
    return app_factory()


@pytest.fixture
def uploaded_doc(client) -> dict:
    pdf = make_pdf(["Stacks are LIFO.", "Queues are FIFO."])
    response = client.post("/upload", files={"file": ("lecture1.pdf", pdf, "application/pdf")})
    assert response.status_code == 200, response.text
    return response.json()
