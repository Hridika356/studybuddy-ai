import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../types/app'
import { buildHistory } from './history'

const user = (id: string, text: string): ChatMessage => ({ id, role: 'user', text })
const answer = (id: string, ...texts: string[]): ChatMessage => ({
  id,
  role: 'assistant',
  parts: texts.map((text, i) => ({ text, pages: [i + 1] })),
})
const error = (id: string, retryQuestion: string): ChatMessage => ({
  id,
  role: 'error',
  text: 'The AI service is busy.',
  retryQuestion,
})

describe('buildHistory', () => {
  it('pairs each question with the answer right after it and joins answer parts', () => {
    const messages = [user('1', 'What is a stack?'), answer('2', 'A stack is LIFO.', ' Push adds.')]
    expect(buildHistory(messages, 4, 4000)).toEqual([
      { question: 'What is a stack?', answer: 'A stack is LIFO. Push adds.' },
    ])
  })

  it('skips questions that ended in an error or have no answer yet', () => {
    const messages = [
      user('1', 'Failed question'),
      error('2', 'Failed question'),
      user('3', 'Good question'),
      answer('4', 'Good answer.'),
      user('5', 'Still waiting'),
    ]
    expect(buildHistory(messages, 4, 4000)).toEqual([
      { question: 'Good question', answer: 'Good answer.' },
    ])
  })

  it('keeps only the most recent maxTurns pairs, oldest first', () => {
    const messages = [1, 2, 3, 4, 5, 6].flatMap((n) => [user(`q${n}`, `Q${n}`), answer(`a${n}`, `A${n}`)])
    expect(buildHistory(messages, 4, 4000).map((turn) => turn.question)).toEqual(['Q3', 'Q4', 'Q5', 'Q6'])
  })

  it('trims and clips each field to maxLen', () => {
    const messages = [user('1', '   padded question   '), answer('2', 'x'.repeat(50))]
    expect(buildHistory(messages, 4, 10)).toEqual([{ question: 'padded que', answer: 'x'.repeat(10) }])
  })

  it('drops pairs that would be blank (the backend rejects blank turns)', () => {
    const messages = [user('1', 'Question'), answer('2', '   ')]
    expect(buildHistory(messages, 4, 4000)).toEqual([])
  })

  it('returns an empty list for an empty chat', () => {
    expect(buildHistory([], 4, 4000)).toEqual([])
  })
})
