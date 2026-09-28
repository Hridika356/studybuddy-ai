import { useEffect, useState } from 'react'
import { config } from '../config'
import { checkHealth } from '../services/api'
import { BookIcon } from './Icons'

type BackendStatus = 'checking' | 'waking' | 'online' | 'no-ai' | 'offline'

const STATUS_TEXT: Record<BackendStatus, string> = {
  checking: 'Connecting…',
  waking: 'Waking server… up to 1 min',
  online: 'Connected',
  'no-ai': 'AI not configured',
  offline: 'Server offline',
}

const HEALTH_RETRY_INTERVAL_MS = 3_000

export function AppHeader() {
  const [status, setStatus] = useState<BackendStatus>('checking')

  useEffect(() => {
    // The free backend sleeps when idle. Instead of reporting "offline" while it boots, keep
    // retrying /health until it answers or the wake budget runs out.
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    const deadline = startedAt + config.serverWakeTimeoutMs

    const noticeTimer = setTimeout(() => {
      if (active) setStatus((current) => (current === 'checking' ? 'waking' : current))
    }, config.serverWakeNoticeDelayMs)

    function attempt() {
      const remaining = deadline - Date.now()
      checkHealth(Math.max(remaining, 1))
        .then((health) => {
          if (!active) return
          clearTimeout(noticeTimer)
          setStatus(health.ai_configured ? 'online' : 'no-ai')
        })
        .catch(() => {
          if (!active) return
          if (Date.now() + HEALTH_RETRY_INTERVAL_MS < deadline) {
            retryTimer = setTimeout(attempt, HEALTH_RETRY_INTERVAL_MS)
          } else {
            clearTimeout(noticeTimer)
            setStatus('offline')
          }
        })
    }
    attempt()

    return () => {
      active = false
      clearTimeout(noticeTimer)
      clearTimeout(retryTimer)
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
