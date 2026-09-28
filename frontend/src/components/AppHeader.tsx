import { useEffect, useState } from 'react'
import { checkHealth } from '../services/api'
import { BookIcon } from './Icons'

type BackendStatus = 'checking' | 'online' | 'no-ai' | 'offline'

const STATUS_TEXT: Record<BackendStatus, string> = {
  checking: 'Connecting…',
  online: 'Connected',
  'no-ai': 'AI not configured',
  offline: 'Server offline',
}

export function AppHeader() {
  const [status, setStatus] = useState<BackendStatus>('checking')

  useEffect(() => {
    let active = true
    checkHealth()
      .then((health) => active && setStatus(health.ai_configured ? 'online' : 'no-ai'))
      .catch(() => active && setStatus('offline'))
    return () => {
      active = false
    }
  }, [])

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <a className="brand" href="/" aria-label="StudyBuddy AI home">
          <span className="brand__mark">
            <BookIcon width={20} height={20} />
          </span>
          <span className="brand__name">StudyBuddy AI</span>
        </a>
        <span className={`status status--${status}`} role="status" aria-live="polite">
          <span className="status__dot" aria-hidden="true" />
          <span className="status__text">{STATUS_TEXT[status]}</span>
        </span>
      </div>
    </header>
  )
}
