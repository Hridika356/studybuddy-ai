from fastapi import APIRouter, Depends

from app.dependencies import AiRateLimit, get_claude_service, get_document_service
from app.schemas.quiz import QuizRequest, QuizResponse
from app.services.claude_service import ClaudeService
from app.services.document_service import DocumentService

router = APIRouter(tags=["quiz"])


@router.post("/quiz", response_model=QuizResponse)
def generate_quiz(
    body: QuizRequest,
    documents: DocumentService = Depends(get_document_service),
    claude: ClaudeService = Depends(get_claude_service),
    rate_limit: AiRateLimit = Depends(),
) -> QuizResponse:
    loaded = documents.load(body.doc_id)
    rate_limit.check()
    return claude.generate_quiz(loaded.data, loaded.document.original_filename)
