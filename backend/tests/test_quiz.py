import json

import pytest

from app.services.quiz_parser import QuizParseError, parse_quiz
from tests.conftest import plain, text_response


def make_question(i: int, **overrides) -> dict:
    question = {
        "question": f"Question {i}?",
        "options": [f"Right {i}", f"Wrong A{i}", f"Wrong B{i}", f"Wrong C{i}"],
        "correct_answer": f"Right {i}",
        "explanation": f"Because of note {i}.",
    }
    question.update(overrides)
    return question


def valid_quiz_json() -> str:
    return json.dumps({"questions": [make_question(i) for i in range(1, 6)]})


def test_parse_valid_quiz():
    quiz = parse_quiz(valid_quiz_json())
    assert len(quiz.questions) == 5
    assert all(len(q.options) == 4 for q in quiz.questions)


def test_parse_tolerates_code_fences_and_preamble():
    assert len(parse_quiz(f"```json\n{valid_quiz_json()}\n```").questions) == 5
    assert len(parse_quiz(f"Here is your quiz:\n{valid_quiz_json()}").questions) == 5


@pytest.mark.parametrize(
    "payload",
    [
        "not json at all",
        json.dumps({"questions": [make_question(i) for i in range(1, 5)]}),
        json.dumps({"questions": [make_question(i) for i in range(1, 7)]}),
        json.dumps(
            {
                "questions": [make_question(1, options=["a", "b", "c"])]
                + [make_question(i) for i in range(2, 6)]
            }
        ),
        json.dumps(
            {
                "questions": [make_question(1, correct_answer="Nope")]
                + [make_question(i) for i in range(2, 6)]
            }
        ),
        json.dumps(
            {
                "questions": [make_question(1, options=["a", "a", "b", "c"], correct_answer="a")]
                + [make_question(i) for i in range(2, 6)]
            }
        ),
        json.dumps(
            {
                "questions": [make_question(1, explanation="")]
                + [make_question(i) for i in range(2, 6)]
            }
        ),
        json.dumps([make_question(i) for i in range(1, 6)]),
    ],
    ids=[
        "not-json",
        "too-few",
        "too-many",
        "three-options",
        "answer-not-option",
        "duplicate-options",
        "blank-explanation",
        "wrong-root",
    ],
)
def test_parse_rejects_invalid_quizzes(payload):
    with pytest.raises(QuizParseError):
        parse_quiz(payload)


def test_quiz_endpoint_returns_five_valid_questions(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue.append(text_response(plain(valid_quiz_json())))
    response = client.post("/quiz", json={"doc_id": uploaded_doc["doc_id"]})
    assert response.status_code == 200
    questions = response.json()["questions"]
    assert len(questions) == 5
    for q in questions:
        assert len(q["options"]) == 4
        assert q["correct_answer"] in q["options"]
        assert q["explanation"]
    assert len(fake_claude.messages.calls) == 1


def test_quiz_retries_once_with_correction(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue += [
        text_response(plain("Sure! Here's a quiz: {oops")),
        text_response(plain(valid_quiz_json())),
    ]
    response = client.post("/quiz", json={"doc_id": uploaded_doc["doc_id"]})
    assert response.status_code == 200
    assert len(fake_claude.messages.calls) == 2
    retry_messages = fake_claude.messages.calls[1]["messages"]
    assert [m["role"] for m in retry_messages] == ["user", "assistant", "user"]
    assert "could not be used" in retry_messages[2]["content"]


def test_quiz_fails_cleanly_after_second_bad_response(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue += [text_response(plain("nope")), text_response(plain("still nope"))]
    response = client.post("/quiz", json={"doc_id": uploaded_doc["doc_id"]})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_malformed_response"
    assert len(fake_claude.messages.calls) == 2


def test_quiz_unknown_doc(client):
    response = client.post("/quiz", json={"doc_id": "f" * 32})
    assert response.status_code == 404


def test_quiz_invalid_doc_id(client):
    response = client.post("/quiz", json={"doc_id": "not-an-id"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_doc_id"


def test_quiz_retry_never_echoes_blank_assistant_turn(client, fake_claude, uploaded_doc):
    fake_claude.messages.queue += [
        text_response(plain("   ")),
        text_response(plain(valid_quiz_json())),
    ]
    response = client.post("/quiz", json={"doc_id": uploaded_doc["doc_id"]})
    assert response.status_code == 200
    assert fake_claude.messages.calls[1]["messages"][1]["content"] == "(empty response)"
