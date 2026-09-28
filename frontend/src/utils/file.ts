const BYTES_PER_MB = 1024 * 1024

/** Client-side checks for fast feedback. The backend re-validates everything. */
export function validatePdfFile(file: File, maxSizeMb: number): string | null {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!looksLikePdf) return 'Please choose a PDF file (.pdf).'
  if (file.size === 0) return 'This file is empty.'
  if (file.size > maxSizeMb * BYTES_PER_MB) {
    return `This PDF is ${formatFileSize(file.size)}. The maximum is ${maxSizeMb} MB.`
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`
}
