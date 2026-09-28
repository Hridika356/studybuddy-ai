"""Domain model for an uploaded document (metadata only; the PDF lives on disk)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Document:
    doc_id: str
    original_filename: str
    stored_filename: str
    size_bytes: int
    page_count: int
    uploaded_at: datetime
