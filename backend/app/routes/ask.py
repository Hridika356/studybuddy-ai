from fastapi import APIRouter, Depends

from app.config import Settings
from app.dependencies import (
    AiRateLimit,
    get_app_settings,
    get_claude_service,
    get_document_service,
)
from app.errors import AppError
from app.schemas.ask import AskRequest, AskResponse
from app.services.claude_service import ClaudeService
from app.services.document_service import DocumentService

router = APIRouter(tags=["qa"])


# Sync handler: FastAPI runs it in a worker thread, so the blocking SDK call won't stall the loop.
@router.post("/ask", response_model=AskResponse)
def ask(
    body: AskRequest,
    settings: Settings = Depends(get_app_settings),
    documents: DocumentService = Depends(get_document_service),
    claude: ClaudeService = Depends(get_claude_service),
    rate_limit: AiRateLimit = Depends(),
) -> AskResponse:
    if len(body.question) > settings.max_question_length:
        raise AppError(
            "question_too_long",
            f"Please keep your question under {settings.max_question_length} characters.",
        )
    loaded = documents.load(body.doc_id)
    rate_limit.check()
    return AskResponse(
        parts=claude.answer_question(
            loaded.data, loaded.document.original_filename, body.question, body.history
        )
    )
