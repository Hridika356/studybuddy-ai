"""Extract and validate quiz JSON produced by the model. Never uses eval."""

from __future__ import annotations

import json
import re

from pydantic import ValidationError

from app.schemas.quiz import QuizResponse

_CODE_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL | re.IGNORECASE)


class QuizParseError(ValueError):
    """Raised with a short, model-readable description of what was wrong."""


def _extract_json_text(raw: str) -> str:
    text = raw.strip()
    fenced = _CODE_FENCE.match(text)
    if fenced:
        return fenced.group(1)
    # Tolerate a stray sentence before/after the object by slicing to the outermost braces.
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]
    return text


def parse_quiz(raw: str) -> QuizResponse:
    try:
        payload = json.loads(_extract_json_text(raw))
    except json.JSONDecodeError as exc:
        raise QuizParseError(f"Response was not valid JSON ({exc.msg}).") from exc

    try:
        return QuizResponse.model_validate(payload)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc']) or 'root'}: {err['msg']}"
            for err in exc.errors()[:5]
        )
        raise QuizParseError(f"JSON did not match the required schema ({problems}).") from exc
