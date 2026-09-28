import sqlite3

from tests.pdf_factory import make_pdf


def upload(client, name, data, content_type="application/pdf"):
    return client.post("/upload", files={"file": (name, data, content_type)})


def test_valid_pdf_upload(client, settings):
    response = upload(client, "lecture1.pdf", make_pdf(["a", "b", "c"]))
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "lecture1.pdf"
    assert body["page_count"] == 3
    assert len(body["doc_id"]) == 32
    # Stored under a generated name, never the user's filename.
    stored = list(settings.upload_dir.glob("*.pdf"))
    assert [p.name for p in stored] == [f"{body['doc_id']}.pdf"]


def test_upload_response_never_exposes_paths(client, settings):
    body = upload(client, "notes.pdf", make_pdf()).json()
    assert set(body) == {"doc_id", "filename", "page_count"}
    assert str(settings.upload_dir) not in str(body)


def test_metadata_persisted_in_sqlite(client, settings):
    body = upload(client, "week2.pdf", make_pdf()).json()
    with sqlite3.connect(settings.database_path) as conn:
        row = conn.execute(
            "SELECT original_filename, stored_filename, uploaded_at FROM documents WHERE doc_id=?",
            (body["doc_id"],),
        ).fetchone()
    assert row[0] == "week2.pdf"
    assert row[1] == f"{body['doc_id']}.pdf"
    assert row[2]


def test_rejects_non_pdf_extension_and_type(client):
    response = upload(client, "notes.txt", b"just some text", "text/plain")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_rejects_fake_pdf_by_content(client):
    response = upload(client, "virus.pdf", b"MZ\x90\x00 not really a pdf")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_rejects_empty_file(client):
    response = upload(client, "empty.pdf", b"")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_file"


def test_rejects_oversized_file(client, settings):
    too_big = b"%PDF-1.4\n" + b"0" * (settings.max_pdf_size_bytes + 1)
    response = upload(client, "huge.pdf", too_big)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"
    assert list(settings.upload_dir.glob("*.pdf")) == []


def test_rejects_corrupt_pdf(client):
    response = upload(client, "broken.pdf", b"%PDF-1.4\n garbage garbage")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_pdf"


def test_rejects_too_many_pages(client, settings):
    response = upload(client, "long.pdf", make_pdf(["x"] * (settings.max_pdf_pages + 1)))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "too_many_pages"


def test_missing_file_field(client):
    response = client.post("/upload")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_path_traversal_filename_is_sanitized(client, settings):
    body = upload(client, "../../etc/passwd.pdf", make_pdf()).json()
    assert body["filename"] == "passwd.pdf"
    assert not (settings.upload_dir.parent / "passwd.pdf").exists()


def test_accepts_octet_stream_with_pdf_extension(client):
    response = upload(client, "Slides.PDF", make_pdf(), "application/octet-stream")
    assert response.status_code == 200
