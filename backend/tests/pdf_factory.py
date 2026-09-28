"""Build small, valid PDFs in memory for tests (no extra dependencies)."""

from __future__ import annotations


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(pages: list[str] | None = None) -> bytes:
    """Return a PDF with one page per string, each rendering that text."""
    pages = pages if pages is not None else ["Hello from page one."]
    font_id = 3
    page_ids = []
    next_id = 4
    page_objects: list[tuple[int, bytes]] = []
    for text in pages:
        page_id, content_id = next_id, next_id + 1
        next_id += 2
        page_ids.append(page_id)
        lines = text.split("\n")
        ops = ["BT", "/F1 14 Tf", "72 720 Td", "18 TL"]
        for line in lines:
            ops.append(f"({_escape(line)}) Tj T*")
        ops.append("ET")
        stream = "\n".join(ops).encode("latin-1")
        page_objects.append(
            (
                page_id,
                (
                    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                    f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
                ).encode(),
            )
        )
        page_objects.append(
            (content_id, b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        )

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects_by_id = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode(),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }
    objects_by_id.update(dict(page_objects))

    out = bytearray(b"%PDF-1.4\n")
    offsets = {}
    for obj_id in sorted(objects_by_id):
        offsets[obj_id] = len(out)
        out += f"{obj_id} 0 obj\n".encode() + objects_by_id[obj_id] + b"\nendobj\n"
    xref_at = len(out)
    count = max(objects_by_id) + 1
    out += f"xref\n0 {count}\n0000000000 65535 f \n".encode()
    for obj_id in range(1, count):
        out += f"{offsets[obj_id]:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {count} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return bytes(out)
