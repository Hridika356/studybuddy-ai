/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MAX_PDF_SIZE_MB?: string
  readonly VITE_MAX_QUESTION_LENGTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
