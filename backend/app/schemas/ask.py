from pydantic import BaseModel, Field, field_validator

MAX_HISTORY_TURNS = 4
MAX_TURN_TEXT_LENGTH = 4000


class ChatTurn(BaseModel):
    """One earlier question/answer pair, sent back so follow-up questions have context."""

    question: str = Field(min_length=1, max_length=MAX_TURN_TEXT_LENGTH)
    answer: str = Field(min_length=1, max_length=MAX_TURN_TEXT_LENGTH)

    @field_validator("question", "answer")
    @classmethod
    def not_blank(cls, value: str) -> str:
        # The Anthropic API rejects whitespace-only text blocks, so blank turns fail fast here.
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class AskRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=64)
    # The configurable maximum length is enforced in the route using Settings; this is a hard cap.
    question: str = Field(max_length=10_000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=MAX_HISTORY_TURNS)

    @field_validator("doc_id", "question")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        return value.strip()

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, value: str) -> str:
        if not value:
            raise ValueError("Question cannot be empty.")
        return value


class AnswerPart(BaseModel):
    text: str
    pages: list[int] = Field(default_factory=list)


class AskResponse(BaseModel):
    parts: list[AnswerPart]
