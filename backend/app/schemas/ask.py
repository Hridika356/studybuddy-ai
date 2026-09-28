from pydantic import BaseModel, Field, field_validator


class AskRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=64)
    # The configurable maximum length is enforced in the route using Settings; this is a hard cap.
    question: str = Field(max_length=10_000)

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
