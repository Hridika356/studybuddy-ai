"""Turn Claude's cited text blocks into frontend-friendly answer parts.

With citations enabled, Claude splits its answer into several `text` blocks. Blocks that make a
claim from the document carry `citations`; for PDFs each is a `page_location` whose
`start_page_number` is 1-indexed and `end_page_number` is exclusive. Page numbers come only from
that metadata — we never infer them from the text.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from app.schemas.ask import AnswerPart


def _get(obj: Any, name: str) -> Any:
    """Read a field from an SDK object or a plain dict (tests and future SDK shapes)."""
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def pages_from_citation(citation: Any) -> list[int]:
    if _get(citation, "type") != "page_location":
        return []
    start = _get(citation, "start_page_number")
    end = _get(citation, "end_page_number")
    if not isinstance(start, int) or start < 1:
        return []
    if not isinstance(end, int) or end <= start:
        return [start]
    return list(range(start, end))


def parse_cited_answer(content_blocks: Iterable[Any]) -> list[AnswerPart]:
    parts: list[AnswerPart] = []
    for block in content_blocks:
        if _get(block, "type") != "text":
            continue
        text = _get(block, "text") or ""
        pages = sorted(
            {
                page
                for citation in (_get(block, "citations") or [])
                for page in pages_from_citation(citation)
            }
        )

        if not text.strip() and not pages:
            # Whitespace-only glue between cited blocks: keep spacing, don't make a new part.
            if parts:
                parts[-1] = AnswerPart(text=parts[-1].text + text, pages=parts[-1].pages)
            continue

        previous = parts[-1] if parts else None
        if previous and not pages and not previous.pages:
            # Merge consecutive uncited text so the frontend receives fewer, cleaner parts.
            parts[-1] = AnswerPart(text=previous.text + text, pages=[])
        else:
            parts.append(AnswerPart(text=text, pages=pages))

    if parts:
        parts[0] = AnswerPart(text=parts[0].text.lstrip(), pages=parts[0].pages)
        parts[-1] = AnswerPart(text=parts[-1].text.rstrip(), pages=parts[-1].pages)
    return [part for part in parts if part.text or part.pages]
