import type { AnswerPart, QuizQuestion } from './api'

export interface StudyDocument {
  docId: string
  filename: string
  pageCount: number
  /** Browser-local object URL for the uploaded file, used to open it at a cited page. */
  fileUrl?: string
}

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; parts: AnswerPart[] }
  | { id: string; role: 'error'; text: string; retryQuestion: string }

export type QuizState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; questions: QuizQuestion[]; quizId: number }
