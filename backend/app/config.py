"""Centralized configuration. Every environment variable is read here and nowhere else."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BACKEND_DIR / ".env", override=False)

DEFAULT_MODEL = "claude-haiku-4-5-20251001"
BYTES_PER_MB = 1024 * 1024


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer") from exc


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be a number") from exc


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    if not raw:
        return default
    path = Path(raw)
    return path if path.is_absolute() else BACKEND_DIR / path


def _env_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # repr=False keeps the key out of any accidental log/print of the settings object.
    anthropic_api_key: str | None = field(repr=False)
    anthropic_model: str
    anthropic_timeout_seconds: float
    anthropic_max_retries: int
    answer_max_tokens: int
    quiz_max_tokens: int

    max_pdf_size_mb: int
    max_pdf_pages: int
    max_question_length: int

    allowed_origins: list[str]
    upload_dir: Path
    database_path: Path

    rate_limit_requests: int
    rate_limit_window_seconds: int

    log_level: str

    @property
    def max_pdf_size_bytes(self) -> int:
        return self.max_pdf_size_mb * BYTES_PER_MB

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)


def load_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        anthropic_model=os.getenv("ANTHROPIC_MODEL") or DEFAULT_MODEL,
        anthropic_timeout_seconds=_env_float("ANTHROPIC_TIMEOUT_SECONDS", 60.0),
        anthropic_max_retries=_env_int("ANTHROPIC_MAX_RETRIES", 2),
        answer_max_tokens=_env_int("ANSWER_MAX_TOKENS", 2048),
        quiz_max_tokens=_env_int("QUIZ_MAX_TOKENS", 4096),
        max_pdf_size_mb=_env_int("MAX_PDF_SIZE_MB", 10),
        # Claude's PDF support caps at 100 pages for 200K-context models such as Haiku 4.5.
        max_pdf_pages=_env_int("MAX_PDF_PAGES", 100),
        max_question_length=_env_int("MAX_QUESTION_LENGTH", 1000),
        allowed_origins=_env_list("ALLOWED_ORIGINS", "http://localhost:5173"),
        upload_dir=_env_path("UPLOAD_DIR", BACKEND_DIR / "uploads"),
        database_path=_env_path("DATABASE_PATH", BACKEND_DIR / "data" / "studybuddy.db"),
        rate_limit_requests=_env_int("RATE_LIMIT_REQUESTS", 10),
        rate_limit_window_seconds=_env_int("RATE_LIMIT_WINDOW_SECONDS", 60),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
    )


@lru_cache
def get_settings() -> Settings:
    return load_settings()
