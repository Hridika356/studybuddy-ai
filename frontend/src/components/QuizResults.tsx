import type { QuizQuestion } from '../types/api'
import { ChatIcon, RefreshIcon, QuizIcon } from './Icons'

interface QuizResultsProps {
  questions: QuizQuestion[]
  results: boolean[]
  onRetry: () => void
  onNewQuiz: () => void
  onBackToChat: () => void
}

function encouragement(score: number, total: number): string {
  const ratio = score / total
  if (ratio === 1) return 'Perfect score. You know this material!'
  if (ratio >= 0.8) return 'Great work. Just a detail or two to review.'
  if (ratio >= 0.5) return 'Solid start. Review the questions you missed and try again.'
  return 'Keep going. Ask StudyBuddy about the topics you missed, then retry.'
}

export function QuizResults({
  questions,
  results,
  onRetry,
  onNewQuiz,
  onBackToChat,
}: QuizResultsProps) {
  const score = results.filter(Boolean).length
  const total = questions.length

  return (
    <div className="quiz-results">
      <p className="quiz-results__eyebrow">Quiz complete</p>
      <h2 className="quiz-results__score" tabIndex={-1} ref={(el) => el?.focus()}>
        Your score: {score} / {total}
      </h2>
      <p className="quiz-results__message">{encouragement(score, total)}</p>

      <ol className="review">
        {questions.map((question, index) => (
          <li
            key={index}
            className={`review__item ${results[index] ? 'review__item--correct' : 'review__item--incorrect'}`}
          >
            <span className="review__status">{results[index] ? 'Correct' : 'Missed'}</span>
            <span className="review__question">{question.question}</span>
            {!results[index] && (
              <span className="review__answer">Answer: {question.correct_answer}</span>
            )}
          </li>
        ))}
      </ol>

      <div className="quiz-results__actions">
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          <RefreshIcon width={18} height={18} /> Retry quiz
        </button>
        <button type="button" className="btn btn--primary" onClick={onNewQuiz}>
          <QuizIcon width={18} height={18} /> Generate new quiz
        </button>
        <button type="button" className="btn btn--ghost" onClick={onBackToChat}>
          <ChatIcon width={18} height={18} /> Return to chat
        </button>
      </div>
    </div>
  )
}
