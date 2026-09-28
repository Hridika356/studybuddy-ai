from fastapi import APIRouter, Depends, File, UploadFile

from app.dependencies import get_document_service
from app.schemas.document import UploadResponse
from app.services.document_service import DocumentService

router = APIRouter(tags=["documents"])


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(..., description="Lecture notes or slides as a PDF"),
    documents: DocumentService = Depends(get_document_service),
) -> UploadResponse:
    document = await documents.upload(file)
    return UploadResponse(
        doc_id=document.doc_id,
        filename=document.original_filename,
        page_count=document.page_count,
    )
