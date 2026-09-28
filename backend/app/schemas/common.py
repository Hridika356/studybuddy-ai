from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    ai_configured: bool


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail
