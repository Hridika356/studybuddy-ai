import type { ChatTurn } from '../types/api'
import type { ChatMessage } from '../types/app'

function clip(text: string, maxLen: number): string {
  return text.trim().slice(0, maxLen).trim()
}

/**
 * Turn the chat log into follow-up context for /ask.
 *
 * Each user message is paired with the assistant answer immediately after it. Questions that
 * ended in an error (or have no answer yet) are skipped, as are pairs that would be blank, since
 * the backend rejects blank turns. Only the most recent `maxTurns` pairs are kept.
 */
export function buildHistory(messages: ChatMessage[], maxTurns: number, maxLen: number): ChatTurn[] {
  const turns: ChatTurn[] = []
  messages.forEach((message, index) => {
    const next = messages[index + 1]
    if (message.role !== 'user' || next?.role !== 'assistant') return
    const question = clip(message.text, maxLen)
    const answer = clip(next.parts.map((part) => part.text).join(''), maxLen)
    if (question && answer) turns.push({ question, answer })
  })
  return maxTurns > 0 ? turns.slice(-maxTurns) : []
}
