import type { StudyDocument } from '../types/app'
import { CheckIcon, FileIcon, QuizIcon } from './Icons'

interface DocumentBarProps {
  document: StudyDocument
  quizBusy: boolean
  onReplace: () => void
  onQuiz: () => void
}

export function DocumentBar({ document, quizBusy, onReplace, onQuiz }: DocumentBarProps) {
  return (
    <section className="document-bar" aria-label="Current document">
      <div className="document-bar__info">
        <span className="document-bar__icon">
          <FileIcon />
        </span>
        <div className="document-bar__text">
          <p className="document-bar__name" title={document.filename}>
            {document.filename}
          </p>
          <p className="document-bar__meta">
            <CheckIcon width={14} height={14} /> Uploaded · {document.pageCount}{' '}
            {document.pageCount === 1 ? 'page' : 'pages'}
          </p>
        </div>
      </div>
      <div className="document-bar__actions">
        <button type="button" className="btn btn--ghost" onClick={onReplace}>
          Replace PDF
        </button>
        <button type="button" className="btn btn--accent" onClick={onQuiz} disabled={quizBusy}>
          <QuizIcon width={18} height={18} /> Quiz me
        </button>
      </div>
    </section>
  )
}
