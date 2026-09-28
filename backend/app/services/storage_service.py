"""Local-disk PDF storage. Files are named by generated doc_id, never by user input."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


class StorageError(OSError):
    pass


class StorageService:
    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir

    def initialize(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, stored_filename: str) -> Path:
        path = (self.upload_dir / stored_filename).resolve()
        # Defense in depth: stored filenames are generated, but never allow escaping upload_dir.
        if path.parent != self.upload_dir.resolve():
            raise StorageError("Invalid stored filename")
        return path

    def save(self, stored_filename: str, data: bytes) -> None:
        target = self._path_for(stored_filename)
        try:
            # Write to a temp file then rename, so a crash never leaves a half-written PDF.
            fd, tmp_path = tempfile.mkstemp(dir=self.upload_dir, suffix=".part")
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
            os.replace(tmp_path, target)
        except OSError as exc:
            logger.error("Failed to store upload %s: %s", stored_filename, type(exc).__name__)
            raise StorageError("Could not save file") from exc

    def read(self, stored_filename: str) -> bytes | None:
        path = self._path_for(stored_filename)
        try:
            return path.read_bytes()
        except FileNotFoundError:
            return None
        except OSError as exc:
            logger.error("Failed to read stored file %s: %s", stored_filename, type(exc).__name__)
            raise StorageError("Could not read file") from exc

    def delete(self, stored_filename: str) -> None:
        try:
            self._path_for(stored_filename).unlink(missing_ok=True)
        except OSError:
            logger.warning("Failed to clean up %s", stored_filename)
