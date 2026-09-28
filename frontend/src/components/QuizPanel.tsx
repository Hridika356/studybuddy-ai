import { useState } from 'react'
import type { QuizState } from '../types/app'
import { AlertIcon, ChatIcon } from './Icons'
import { QuizQuestionCard } from './QuizQuestionCard'
import { QuizResults } from './QuizResults'
import { Spinner } from './Spinner'

interface QuizPanelProps {
  quiz: QuizState
  onNewQuiz: () => void
  onBackToChat: () => void
}

export function QuizPanel({ quiz, onNewQuiz, onBackToChat }: QuizPanelProps) {
  // Bumping the attempt remounts the run, resetting progress for "Retry quiz".
  const [attempt, setAttempt] = useState(0)

  return (
    <section className="card quiz" aria-label="Practice quiz">
      <header className="quiz__header">
        <h2 className="card__title">Practice quiz</h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBackToChat}>
          <ChatIcon width={16} height={16} /> Back to chat
        </button>
      </header>

      {quiz.status === 'loading' && (
        <div className="quiz__state">
          <Spinner label="Writing 5 questions from your notes… this can take up to a minute." />
        </div>
      )}

      {quiz.status === 'error' && (
        <div className="quiz__state">
          <p className="alert alert--error" role="alert">
            <AlertIcon />
            <span>{quiz.message}</span>
          </p>
          <button type="button" className="btn btn--primary" onClick={onNewQuiz}>
            Try again
          </button>
        </div>
      )}

      {quiz.status === 'ready' && (
        <QuizRun
          key={`${quiz.quizId}-${attempt}`}
          questions={quiz.questions}
          onRetry={() => setAttempt((n) => n + 1)}
          onNewQuiz={onNewQuiz}
          onBackToChat={onBackToChat}
        />
      )}
    </section>
  )
}

interface QuizRunProps {
  questions: Extract<QuizState, { status: 'ready' }>['questions']
  onRetry: () => void
  onNewQuiz: () => void
  onBackToChat: () => void
}

function QuizRun({ questions, onRetry, onNewQuiz, onBackToChat }: QuizRunProps) {
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const finished = index >= questions.length

  if (finished) {
    return (
      <QuizResults
        questions={questions}
        results={results}
        onRetry={onRetry}
        onNewQuiz={onNewQuiz}
        onBackToChat={onBackToChat}
      />
    )
  }

  return (
    <QuizQuestionCard
      key={index}
      question={questions[index]}
      number={index + 1}
      total={questions.length}
      onAnswered={(correct) =>
        setResults((previous) => {
          const next = [...previous]
          next[index] = correct
          return next
        })
      }
      onNext={() => setIndex((i) => i + 1)}
    />
  )
}
