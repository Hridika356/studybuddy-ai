import { config } from '../config'
import type {
  ApiErrorBody,
  AskResponse,
  ChatTurn,
  HealthResponse,
  QuizResponse,
  UploadResponse,
} from '../types/api'

/** Error with a user-friendly message; `code` mirrors the backend's error codes. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const NETWORK_ERROR_MESSAGE =
  "Can't reach the StudyBuddy server. Check your connection and try again."

function buildUrl(path: string): string {
  if (!config.apiBaseUrl) {
    throw new ApiError(
      'config_error',
      'The app is missing its server address (VITE_API_BASE_URL).',
    )
  }
  return `${config.apiBaseUrl}${path}`
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return typeof error === 'object' && error !== null && 'message' in error && 'code' in error
}

function errorFromResponse(status: number, body: unknown): ApiError {
  if (isApiErrorBody(body)) {
    return new ApiError(body.error.code, body.error.message, status)
  }
  if (status === 413) {
    return new ApiError('file_too_large', 'That file is too large to upload.', status)
  }
  return new ApiError('http_error', `The server returned an unexpected error (${status}).`, status)
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const url = buildUrl(path)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError('timeout', 'The request took too long. Please try again.')
    }
    throw new ApiError('network_error', NETWORK_ERROR_MESSAGE)
  } finally {
    clearTimeout(timer)
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw errorFromResponse(response.status, body)
  if (body === null) {
    throw new ApiError('bad_response', 'The server sent a response we could not read.')
  }
  return body as T
}

function postJson<T>(path: string, payload: unknown, timeoutMs: number): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  )
}

export function checkHealth(
  timeoutMs: number = config.defaultRequestTimeoutMs,
): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/health', { method: 'GET' }, timeoutMs)
}

export function askQuestion(
  docId: string,
  question: string,
  history: ChatTurn[] = [],
): Promise<AskResponse> {
  // Omit `history` when empty so a first question sends exactly the same body as before.
  const body = history.length > 0 ? { doc_id: docId, question, history } : { doc_id: docId, question }
  return postJson<AskResponse>('/ask', body, config.aiRequestTimeoutMs)
}

export function generateQuiz(docId: string): Promise<QuizResponse> {
  return postJson<QuizResponse>('/quiz', { doc_id: docId }, config.aiRequestTimeoutMs)
}

/**
 * Upload uses XMLHttpRequest rather than fetch because fetch can't report upload progress.
 * `onProgress` receives a 0–100 percentage.
 */
export function uploadPdf(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    let url: string
    try {
      url = buildUrl('/upload')
    } catch (error) {
      reject(error)
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = config.aiRequestTimeoutMs
    xhr.responseType = 'text'

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && body !== null) {
        resolve(body as UploadResponse)
      } else {
        reject(errorFromResponse(xhr.status, body))
      }
    }
    xhr.onerror = () => reject(new ApiError('network_error', NETWORK_ERROR_MESSAGE))
    xhr.ontimeout = () =>
      reject(new ApiError('timeout', 'The upload took too long. Please try again.'))

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}
