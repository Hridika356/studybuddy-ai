import type { ChatMessage } from '../types/app'
import { toPageRanges } from '../utils/pages'
import { CitationChip } from './CitationChip'
import { AlertIcon, RefreshIcon } from './Icons'

interface ChatMessageViewProps {
  message: ChatMessage
  onRetry?: (question: string) => void
  retryDisabled?: boolean
}

export function ChatMessageView({ message, onRetry, retryDisabled }: ChatMessageViewProps) {
  if (message.role === 'user') {
    return (
      <li className="message message--user">
        <span className="sr-only">You asked:</span>
        <p className="message__bubble">{message.text}</p>
      </li>
    )
  }

  if (message.role === 'error') {
    return (
      <li className="message message--assistant">
        <div className="message__bubble message__bubble--error" role="alert">
          <p className="message__error-text">
            <AlertIcon />
            <span>{message.text}</span>
          </p>
          {onRetry && (
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => onRetry(message.retryQuestion)}
              disabled={retryDisabled}
            >
              <RefreshIcon width={16} height={16} /> Try again
            </button>
          )}
        </div>
      </li>
    )
  }

  const hasCitations = message.parts.some((part) => part.pages.length > 0)
  return (
    <li className="message message--assistant">
      <span className="sr-only">StudyBuddy answered:</span>
      <div className="message__bubble message__bubble--answer">
        <p className="answer">
          {message.parts.map((part, index) => (
            <span key={index} className="answer__part">
              {part.text}
              {toPageRanges(part.pages).map((range) => (
                <CitationChip key={`${range.start}-${range.end}`} range={range} />
              ))}
            </span>
          ))}
        </p>
        {!hasCitations && (
          <p className="answer__note">No page citations were returned for this answer.</p>
        )}
      </div>
    </li>
  )
}
