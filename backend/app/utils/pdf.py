from __future__ import annotations

import io
import logging
import re
import unicodedata

from pypdf import PdfReader
from pypdf.errors import PdfReadError

logger = logging.getLogger(__name__)

PDF_MAGIC = b"%PDF-"
MAX_DISPLAY_FILENAME_LENGTH = 120
_UNSAFE_FILENAME_CHARS = re.compile(r"[\x00-\x1f\x7f<>:\"/\\|?*]")


class InvalidPdfError(ValueError):
    pass


class EncryptedPdfError(ValueError):
    pass


def looks_like_pdf(header: bytes) -> bool:
    return header.startswith(PDF_MAGIC)


def count_pages(data: bytes) -> int:
    """Parse the PDF to confirm it is readable and return its page count."""
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise EncryptedPdfError("PDF is password protected")
        return len(reader.pages)
    except EncryptedPdfError:
        raise
    except (PdfReadError, ValueError, KeyError, TypeError, OSError) as exc:
        logger.info("PDF parse failed: %s", type(exc).__name__)
        raise InvalidPdfError("PDF could not be read") from exc


def display_filename(original: str | None) -> str:
    """Return a safe, human-readable filename for display only (never used for storage)."""
    name = (original or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = unicodedata.normalize("NFC", name)
    name = _UNSAFE_FILENAME_CHARS.sub("", name).strip().strip(".")
    if not name:
        return "document.pdf"
    if len(name) > MAX_DISPLAY_FILENAME_LENGTH:
        stem, dot, ext = name.rpartition(".")
        keep = MAX_DISPLAY_FILENAME_LENGTH - len(ext) - 1
        name = f"{stem[:keep]}.{ext}" if dot and keep > 0 else name[:MAX_DISPLAY_FILENAME_LENGTH]
    return name
