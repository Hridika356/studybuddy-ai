import { useId, useRef, useState, type DragEvent } from 'react'
import { config } from '../config'
import { errorMessage, uploadPdf } from '../services/api'
import type { StudyDocument } from '../types/app'
import { formatFileSize, validatePdfFile } from '../utils/file'
import { AlertIcon, FileIcon, UploadIcon } from './Icons'

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number }
  | { kind: 'error'; message: string }

interface UploadCardProps {
  onUploaded: (document: StudyDocument) => void
  onCancel?: () => void
}

export function UploadCard({ onUploaded, onCancel }: UploadCardProps) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<UploadStatus>({ kind: 'idle' })
  const [selected, setSelected] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const uploading = status.kind === 'uploading'

  async function handleFile(file: File | undefined) {
    if (!file || uploading) return
    setSelected(file)
    const problem = validatePdfFile(file, config.maxPdfSizeMb)
    if (problem) {
      setStatus({ kind: 'error', message: problem })
      return
    }
    setStatus({ kind: 'uploading', progress: 0 })
    try {
      const result = await uploadPdf(file, (progress) =>
        setStatus({ kind: 'uploading', progress }),
      )
      setStatus({ kind: 'idle' })
      // A browser-local copy of the file lets citation chips open it at the cited page.
      // Guarded because some environments (older jsdom, unusual browsers) lack createObjectURL.
      const fileUrl =
        typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined
      onUploaded({
        docId: result.doc_id,
        filename: result.filename,
        pageCount: result.page_count,
        fileUrl,
      })
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) })
    } finally {
      // Allow re-selecting the same file after an error.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files[0])
  }

  return (
    <section className="card upload-card" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="card__title">
        Upload your lecture notes
      </h2>

      <label
        htmlFor={inputId}
        className={`dropzone${dragging ? ' dropzone--active' : ''}${uploading ? ' dropzone--busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!uploading) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="dropzone__icon">
          <UploadIcon width={28} height={28} />
        </span>
        <span className="dropzone__primary">
          {dragging ? 'Drop your PDF here' : 'Drag & drop a PDF, or click to browse'}
        </span>
        <span className="dropzone__hint" id={hintId}>
          PDF only · up to {config.maxPdfSizeMb} MB · max {config.maxPdfPages} pages
        </span>
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          aria-describedby={hintId}
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </label>

      {selected && (
        <div className="upload-card__file">
          <FileIcon />
          <span className="upload-card__filename">{selected.name}</span>
          <span className="upload-card__size">{formatFileSize(selected.size)}</span>
        </div>
      )}

      {status.kind === 'uploading' && (
        <div className="progress" aria-live="polite">
          <div
            className="progress__track"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.progress}
          >
            <div className="progress__bar" style={{ width: `${status.progress}%` }} />
          </div>
          <span className="progress__label">
            {status.progress < 100 ? `Uploading… ${status.progress}%` : 'Checking your PDF…'}
          </span>
        </div>
      )}

      {status.kind === 'error' && (
        <p className="alert alert--error" role="alert">
          <AlertIcon />
          <span>{status.message}</span>
        </p>
      )}

      {onCancel && (
        <div className="upload-card__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={uploading}>
            Keep current PDF
          </button>
        </div>
      )}
    </section>
  )
}
