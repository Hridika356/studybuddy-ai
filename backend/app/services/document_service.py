from __future__ import annotations

import logging
import re
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.config import Settings
from app.db.document_repository import DocumentRepository
from app.errors import AppError
from app.models.document import Document
from app.services.storage_service import StorageError, StorageService
from app.utils.pdf import (
    EncryptedPdfError,
    InvalidPdfError,
    count_pages,
    display_filename,
    looks_like_pdf,
)

logger = logging.getLogger(__name__)

READ_CHUNK_BYTES = 1024 * 1024
DOC_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


@dataclass(frozen=True)
class LoadedDocument:
    document: Document
    data: bytes


class DocumentService:
    def __init__(self, settings: Settings, repository: DocumentRepository, storage: StorageService):
        self._settings = settings
        self._repository = repository
        self._storage = storage

    async def upload(self, upload: UploadFile) -> Document:
        filename = display_filename(upload.filename)
        self._check_declared_type(upload, filename)
        data = await self._read_limited(upload)

        if not data:
            raise AppError("empty_file", "The uploaded file is empty.")
        if not looks_like_pdf(data[:1024].lstrip()):
            raise AppError(
                "unsupported_file_type",
                "This file is not a valid PDF. Please upload a .pdf file.",
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        try:
            page_count = await run_in_threadpool(count_pages, data)
        except EncryptedPdfError:
            raise AppError("encrypted_pdf", "Password-protected PDFs are not supported.") from None
        except InvalidPdfError:
            raise AppError(
                "invalid_pdf", "This PDF appears to be damaged and could not be read."
            ) from None

        if page_count == 0:
            raise AppError("empty_pdf", "This PDF has no pages.")
        if page_count > self._settings.max_pdf_pages:
            raise AppError(
                "too_many_pages",
                f"This PDF has {page_count} pages. The maximum is {self._settings.max_pdf_pages}.",
            )

        doc_id = uuid.uuid4().hex
        document = Document(
            doc_id=doc_id,
            original_filename=filename,
            stored_filename=f"{doc_id}.pdf",
            size_bytes=len(data),
            page_count=page_count,
            uploaded_at=datetime.now(UTC),
        )

        try:
            await run_in_threadpool(self._storage.save, document.stored_filename, data)
        except StorageError:
            raise AppError(
                "storage_error", "We couldn't save your file. Please try again.", 500
            ) from None

        try:
            await run_in_threadpool(self._repository.add, document)
        except sqlite3.Error:
            logger.exception("Database insert failed for %s", doc_id)
            self._storage.delete(document.stored_filename)
            raise AppError(
                "database_error", "We couldn't record your upload. Please try again.", 500
            ) from None

        logger.info("Stored document %s (%d pages, %d bytes)", doc_id, page_count, len(data))
        return document

    def load(self, doc_id: str) -> LoadedDocument:
        if not DOC_ID_PATTERN.fullmatch(doc_id):
            raise AppError("invalid_doc_id", "The document ID is not valid.")

        try:
            document = self._repository.get(doc_id)
        except sqlite3.Error:
            logger.exception("Database lookup failed for %s", doc_id)
            raise AppError("database_error", "We couldn't look up that document.", 500) from None
        if document is None:
            raise AppError(
                "document_not_found",
                "That document was not found. Please upload your PDF again.",
                status.HTTP_404_NOT_FOUND,
            )

        try:
            data = self._storage.read(document.stored_filename)
        except StorageError:
            raise AppError("storage_error", "We couldn't read that document.", 500) from None
        if data is None:
            raise AppError(
                "document_not_found",
                "The file for this document is no longer available. Please upload it again.",
                status.HTTP_404_NOT_FOUND,
            )
        return LoadedDocument(document=document, data=data)

    def _check_declared_type(self, upload: UploadFile, filename: str) -> None:
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        has_pdf_extension = filename.lower().endswith(".pdf")
        if not has_pdf_extension and content_type not in PDF_CONTENT_TYPES:
            raise AppError(
                "unsupported_file_type",
                "Only PDF files are supported.",
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

    async def _read_limited(self, upload: UploadFile) -> bytes:
        """Read the upload in chunks, stopping as soon as it exceeds the size limit."""
        limit = self._settings.max_pdf_size_bytes
        buffer = bytearray()
        while chunk := await upload.read(READ_CHUNK_BYTES):
            buffer.extend(chunk)
            if len(buffer) > limit:
                raise AppError(
                    "file_too_large",
                    f"This PDF is larger than the {self._settings.max_pdf_size_mb} MB limit.",
                    status.HTTP_413_CONTENT_TOO_LARGE,
                )
        return bytes(buffer)
