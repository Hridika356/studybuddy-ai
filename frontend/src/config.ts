// All frontend configuration comes from Vite env vars (see .env.example).
// Nothing secret belongs here: every VITE_* value is bundled into public JavaScript.

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, ''),
  // Keep these in sync with the backend's MAX_PDF_SIZE_MB / MAX_QUESTION_LENGTH.
  maxPdfSizeMb: numberFromEnv(import.meta.env.VITE_MAX_PDF_SIZE_MB, 10),
  // Claude's PDF page limit for the default model; the backend enforces MAX_PDF_PAGES.
  maxPdfPages: 100,
  maxQuestionLength: numberFromEnv(import.meta.env.VITE_MAX_QUESTION_LENGTH, 1000),
  // AI calls send the whole PDF; allow generous time before giving up.
  aiRequestTimeoutMs: 120_000,
  defaultRequestTimeoutMs: 15_000,
} as const
