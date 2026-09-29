// Mirrors backend/app/schemas. Keep in sync when the API changes.

export interface HealthResponse {
  status: string
  ai_configured: boolean
}

export interface UploadResponse {
  doc_id: string
  filename: string
  page_count: number
}

export interface AnswerPart {
  text: string
  pages: number[]
}

export interface ChatTurn {
  question: string
  answer: string
}

export interface AskResponse {
  parts: AnswerPart[]
}

export interface QuizQuestion {
  question: string
  options: string[]
  correct_answer: string
  explanation: string
}

export interface QuizResponse {
  questions: QuizQuestion[]
}

export interface ApiErrorBody {
  error: { code: string; message: string }
}
