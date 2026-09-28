import { describe, expect, it } from 'vitest'
import { validatePdfFile } from './file'

const mb = 1024 * 1024

function fileOf(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('validatePdfFile', () => {
  it('accepts a normal PDF', () => {
    expect(validatePdfFile(fileOf('notes.pdf', 2 * mb), 10)).toBeNull()
  })

  it('accepts .pdf extension even without a MIME type', () => {
    expect(validatePdfFile(fileOf('notes.PDF', 100, ''), 10)).toBeNull()
  })

  it('rejects non-PDF files', () => {
    expect(validatePdfFile(fileOf('notes.docx', 100, 'application/msword'), 10)).toMatch(/PDF/)
  })

  it('rejects empty files', () => {
    expect(validatePdfFile(fileOf('notes.pdf', 0), 10)).toMatch(/empty/)
  })

  it('rejects oversized files with the limit in the message', () => {
    expect(validatePdfFile(fileOf('big.pdf', 11 * mb), 10)).toMatch(/maximum is 10 MB/)
  })
})
