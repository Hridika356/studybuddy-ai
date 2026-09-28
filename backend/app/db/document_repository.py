"""All SQL for documents lives here."""

from __future__ import annotations

import sqlite3
from datetime import datetime

from app.db.connection import Database
from app.models.document import Document


class DocumentRepository:
    def __init__(self, database: Database):
        self._db = database

    def add(self, document: Document) -> None:
        with self._db.connect() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    doc_id, original_filename, stored_filename, size_bytes, page_count, uploaded_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    document.doc_id,
                    document.original_filename,
                    document.stored_filename,
                    document.size_bytes,
                    document.page_count,
                    document.uploaded_at.isoformat(),
                ),
            )

    def get(self, doc_id: str) -> Document | None:
        with self._db.connect() as conn:
            row = conn.execute("SELECT * FROM documents WHERE doc_id = ?", (doc_id,)).fetchone()
        return _row_to_document(row) if row else None


def _row_to_document(row: sqlite3.Row) -> Document:
    return Document(
        doc_id=row["doc_id"],
        original_filename=row["original_filename"],
        stored_filename=row["stored_filename"],
        size_bytes=row["size_bytes"],
        page_count=row["page_count"],
        uploaded_at=datetime.fromisoformat(row["uploaded_at"]),
    )
