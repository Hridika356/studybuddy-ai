import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { config } from '../config'
import type { ChatMessage } from '../types/app'
import type { PageRange } from '../utils/pages'
import { ChatMessageView } from './ChatMessageView'
import { ChatIcon, SendIcon } from './Icons'
import { Spinner } from './Spinner'

const SUGGESTIONS = [
  'Summarize the main ideas of these notes.',
  'What are the key definitions I should know?',
  'Explain the hardest concept in simple terms.',
]

interface ChatPanelProps {
  filename: string
  messages: ChatMessage[]
  pending: boolean
  onAsk: (question: string) => void
  onOpenPage?: (range: PageRange) => void
}

export function ChatPanel({ filename, messages, pending, onAsk, onOpenPage }: ChatPanelProps) {
  const inputId = useId()
  const counterId = useId()
  const [draft, setDraft] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = draft.trim()
  const tooLong = draft.length > config.maxQuestionLength
  const canSend = trimmed.length > 0 && !tooLong && !pending

  useEffect(() => {
    logEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages.length, pending])

  function submit(question: string) {
    const text = question.trim()
    if (!text || pending || text.length > config.maxQuestionLength) return
    onAsk(text)
    setDraft('')
    inputRef.current?.focus()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline. Ignore Enter while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(draft)
    }
  }

  return (
    <section className="card chat" aria-label="Ask questions about your notes">
      {messages.length === 0 ? (
        <div className="chat__empty">
          <span className="chat__empty-icon">
            <ChatIcon width={28} height={28} />
          </span>
          <h2 className="chat__empty-title">Ask anything about {filename}</h2>
          <p className="chat__empty-text">
            Answers come only from your PDF, with page citations you can click to check the source.
            Follow-up questions work too, so ask “why?” or “give me an example”.
          </p>
          <div className="suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="suggestion"
                onClick={() => submit(suggestion)}
                disabled={pending}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ol className="chat__log" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((message) => (
            <ChatMessageView
              key={message.id}
              message={message}
              onRetry={submit}
              retryDisabled={pending}
              onOpenPage={onOpenPage}
            />
          ))}
          {pending && (
            <li className="message message--assistant">
              <div className="message__bubble message__bubble--pending">
                <Spinner size="sm" label="Reading your notes…" />
              </div>
            </li>
          )}
        </ol>
      )}
      <div ref={logEndRef} />

      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="sr-only">
          Your question
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          className="composer__input"
          rows={2}
          placeholder="Ask a question about your notes…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={counterId}
          aria-invalid={tooLong}
        />
        <div className="composer__footer">
          <span id={counterId} className={`composer__hint${tooLong ? ' composer__hint--error' : ''}`}>
            {tooLong
              ? `Too long: ${draft.length}/${config.maxQuestionLength} characters`
              : 'Enter to send · Shift+Enter for a new line'}
          </span>
          <button type="submit" className="btn btn--primary" disabled={!canSend}>
            {pending ? <Spinner size="sm" /> : <SendIcon width={18} height={18} />}
            <span>{pending ? 'Thinking' : 'Ask'}</span>
          </button>
        </div>
      </form>
    </section>
  )
}
