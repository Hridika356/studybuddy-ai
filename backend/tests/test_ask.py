import anthropic
import httpx2
import pytest

from tests.conftest import cited, plain, text_response


def ask(client, doc_id, question="What is a stack?"):
    return client.post("/ask", json={"doc_id": doc_id, "question": question})


def test_ask_returns_cited_parts(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(
        text_response(plain("From your notes: "), cited("A stack is LIFO.", 1))
    )
    response = ask(client, uploaded_doc["doc_id"])
    assert response.status_code == 200
    assert response.json() == {
        "parts": [
            {"text": "From your notes: ", "pages": []},
            {"text": "A stack is LIFO.", "pages": [1]},
        ]
    }


def test_ask_sends_pdf_with_citations_enabled(client, fake_claude, uploaded_doc, settings):
    fake_claude.messages.queue.append(text_response(cited("Yes.", 1)))
    ask(client, uploaded_doc["doc_id"], "  What is a stack?  ")
    call = fake_claude.messages.calls[0]
    assert call["model"] == settings.anthropic_model
    doc_block, question_block = call["messages"][0]["content"]
    assert doc_block["type"] == "document"
    assert doc_block["source"]["media_type"] == "application/pdf"
    assert doc_block["citations"] == {"enabled": True}
    assert question_block == {"type": "text", "text": "What is a stack?"}
    assert "ONLY" in call["system"]


def test_unknown_doc_id(client):
    response = ask(client, "0" * 32)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "document_not_found"


def test_malformed_doc_id(client):
    response = ask(client, "../../etc/passwd")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_doc_id"


@pytest.mark.parametrize("question", ["", "   ", "\n\t"])
def test_empty_question(client, uploaded_doc, question):
    response = ask(client, uploaded_doc["doc_id"], question)
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert "empty" in body["message"].lower()


def test_question_too_long(client, uploaded_doc, settings):
    response = ask(client, uploaded_doc["doc_id"], "x" * (settings.max_question_length + 1))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "question_too_long"


def test_missing_fields(client):
    response = client.post("/ask", json={})
    assert response.status_code == 422


def test_file_deleted_from_disk(client, uploaded_doc, settings):
    (settings.upload_dir / f"{uploaded_doc['doc_id']}.pdf").unlink()
    response = ask(client, uploaded_doc["doc_id"])
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "document_not_found"


def test_missing_api_key_returns_503(app_factory):
    client = app_factory(claude_client=None)  # real client path, no key configured
    from tests.pdf_factory import make_pdf

    doc = client.post("/upload", files={"file": ("a.pdf", make_pdf(), "application/pdf")}).json()
    response = ask(client, doc["doc_id"])
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_not_configured"


def _status_error(cls, status_code):
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx2.Response(status_code, request=request)
    return cls("boom", response=response, body=None)


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (lambda: _status_error(anthropic.RateLimitError, 429), 503, "ai_busy"),
        (lambda: _status_error(anthropic.AuthenticationError, 401), 503, "ai_auth_error"),
        (lambda: _status_error(anthropic.BadRequestError, 400), 502, "ai_request_rejected"),
        (lambda: _status_error(anthropic.InternalServerError, 500), 502, "ai_error"),
        (
            lambda: anthropic.APITimeoutError(request=httpx2.Request("POST", "https://x")),
            504,
            "ai_timeout",
        ),
        (
            lambda: anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")),
            502,
            "ai_unavailable",
        ),
    ],
)
def test_claude_errors_are_mapped(client, fake_claude, uploaded_doc, error, status, code):
    fake_claude.messages.queue.append(error())
    response = ask(client, uploaded_doc["doc_id"])
    assert response.status_code == status
    body = response.json()
    assert body["error"]["code"] == code
    assert "Traceback" not in response.text


def test_refusal_is_reported(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(text_response(stop_reason="refusal"))
    response = ask(client, uploaded_doc["doc_id"])
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ai_refused"


def test_empty_model_answer(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(text_response(plain("   ")))
    response = ask(client, uploaded_doc["doc_id"])
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_empty_response"


def test_rate_limit(app_factory, fake_claude):
    client = app_factory(rate_limit_requests=2)
    from tests.pdf_factory import make_pdf

    doc = client.post("/upload", files={"file": ("a.pdf", make_pdf(), "application/pdf")}).json()
    fake_claude.messages.queue += [text_response(plain("ok")), text_response(plain("ok"))]
    assert ask(client, doc["doc_id"]).status_code == 200
    assert ask(client, doc["doc_id"]).status_code == 200
    third = ask(client, doc["doc_id"])
    assert third.status_code == 429
    assert third.json()["error"]["code"] == "rate_limited"
    assert len(fake_claude.messages.calls) == 2


def test_invalid_requests_do_not_consume_rate_limit(app_factory):
    client = app_factory(rate_limit_requests=1)
    for _ in range(3):
        assert ask(client, "0" * 32).status_code == 404


# ---- follow-up history ------------------------------------------------------------------------


def _history(n: int) -> list[dict]:
    return [{"question": f"Q{i}?", "answer": f"A{i}."} for i in range(1, n + 1)]


def test_history_builds_alternating_turns_in_order(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(text_response(cited("Follow-up answer.", 2)))
    response = client.post(
        "/ask",
        json={"doc_id": uploaded_doc["doc_id"], "question": "And queues?", "history": _history(2)},
    )
    assert response.status_code == 200
    messages = fake_claude.messages.calls[0]["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "assistant", "user"]
    assert messages[0]["content"][-1] == {"type": "text", "text": "Q1?"}
    assert messages[1]["content"] == "A1."
    assert messages[2]["content"] == [{"type": "text", "text": "Q2?"}]
    assert messages[3]["content"] == "A2."
    assert messages[4]["content"] == [{"type": "text", "text": "And queues?"}]


def test_document_block_only_leads_first_user_turn(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue += [text_response(plain("ok")), text_response(plain("ok"))]
    doc_id = uploaded_doc["doc_id"]
    client.post("/ask", json={"doc_id": doc_id, "question": "Now?", "history": _history(3)})
    client.post("/ask", json={"doc_id": doc_id, "question": "Now?"})
    with_history, without_history = (c["messages"] for c in fake_claude.messages.calls)

    def doc_blocks(message):
        content = message["content"]
        return [b for b in content if isinstance(b, dict) and b.get("type") == "document"]

    assert len(doc_blocks(with_history[0])) == 1
    assert with_history[0]["content"][0]["type"] == "document"
    assert all(not doc_blocks(m) for m in with_history[1:] if isinstance(m["content"], list))
    # Same cached prefix with or without history: identical document block (incl. cache_control).
    assert with_history[0]["content"][0] == without_history[0]["content"][0]
    assert with_history[0]["content"][0]["cache_control"] == {"type": "ephemeral"}
    assert with_history[0]["content"][0]["citations"] == {"enabled": True}


def test_no_history_sends_single_message_exactly_as_before(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(text_response(plain("ok")))
    client.post("/ask", json={"doc_id": uploaded_doc["doc_id"], "question": "What is a stack?"})
    messages = fake_claude.messages.calls[0]["messages"]
    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    doc_block, question_block = messages[0]["content"]
    assert doc_block["type"] == "document"
    assert question_block == {"type": "text", "text": "What is a stack?"}


def test_empty_history_list_matches_no_history(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue += [text_response(plain("ok")), text_response(plain("ok"))]
    doc_id = uploaded_doc["doc_id"]
    client.post("/ask", json={"doc_id": doc_id, "question": "Q"})
    client.post("/ask", json={"doc_id": doc_id, "question": "Q", "history": []})
    first, second = fake_claude.messages.calls
    assert first == second


def test_more_than_four_history_turns_is_rejected(client, fake_claude, uploaded_doc):
    response = client.post(
        "/ask",
        json={"doc_id": uploaded_doc["doc_id"], "question": "Q?", "history": _history(5)},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert fake_claude.messages.calls == []


@pytest.mark.parametrize(
    "turn",
    [
        {"question": "", "answer": "A."},
        {"question": "Q?", "answer": "   "},
        {"question": "Q?", "answer": "x" * 4001},
        {"question": "Q?"},
    ],
    ids=["empty-question", "blank-answer", "answer-too-long", "missing-answer"],
)
def test_invalid_history_turn_is_rejected(client, fake_claude, uploaded_doc, turn):
    response = client.post(
        "/ask", json={"doc_id": uploaded_doc["doc_id"], "question": "Q?", "history": [turn]}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert fake_claude.messages.calls == []


def test_system_prompt_tells_model_to_recite_document_on_follow_ups(
    client, fake_claude, uploaded_doc
):
    fake_claude.messages.queue.append(text_response(plain("ok")))
    client.post(
        "/ask", json={"doc_id": uploaded_doc["doc_id"], "question": "Q", "history": _history(1)}
    )
    system = fake_claude.messages.calls[0]["system"]
    assert "Earlier turns" in system and "cite it again" in system
