from pydantic import BaseModel, Field, field_validator, model_validator

QUIZ_QUESTION_COUNT = 5
QUIZ_OPTION_COUNT = 4


class QuizRequest(BaseModel):
    doc_id: str = Field(min_length=1, max_length=64)

    @field_validator("doc_id")
    @classmethod
    def strip_whitespace(cls, value: str) -> str:
        return value.strip()


class QuizQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(min_length=QUIZ_OPTION_COUNT, max_length=QUIZ_OPTION_COUNT)
    correct_answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1, max_length=2000)

    @field_validator("question", "correct_answer", "explanation")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("options")
    @classmethod
    def options_are_distinct(cls, options: list[str]) -> list[str]:
        cleaned = [option.strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("options must not be blank")
        if len({option.casefold() for option in cleaned}) != len(cleaned):
            raise ValueError("options must be distinct")
        return cleaned

    @model_validator(mode="after")
    def correct_answer_is_an_option(self) -> "QuizQuestion":
        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must exactly match one of the options")
        return self


class QuizResponse(BaseModel):
    questions: list[QuizQuestion] = Field(
        min_length=QUIZ_QUESTION_COUNT, max_length=QUIZ_QUESTION_COUNT
    )
