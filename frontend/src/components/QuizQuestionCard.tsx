import { useId, useState } from 'react'
import type { QuizQuestion } from '../types/api'
import { CheckIcon, XIcon } from './Icons'

interface QuizQuestionCardProps {
  question: QuizQuestion
  number: number
  total: number
  onAnswered: (correct: boolean) => void
  onNext: () => void
}

export function QuizQuestionCard({
  question,
  number,
  total,
  onAnswered,
  onNext,
}: QuizQuestionCardProps) {
  const groupName = useId()
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const isCorrect = checked && selected === question.correct_answer
  const isLast = number === total

  function check() {
    if (selected === null || checked) return
    setChecked(true)
    onAnswered(selected === question.correct_answer)
  }

  function optionClass(option: string): string {
    if (!checked) return option === selected ? 'option option--selected' : 'option'
    if (option === question.correct_answer) return 'option option--correct'
    if (option === selected) return 'option option--incorrect'
    return 'option option--dimmed'
  }

  return (
    <div className="quiz-question">
      <div className="quiz-progress">
        <span className="quiz-progress__label">
          Question {number} of {total}
        </span>
        <div
          className="quiz-progress__track"
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={number}
        >
          <div className="quiz-progress__bar" style={{ width: `${(number / total) * 100}%` }} />
        </div>
      </div>

      <fieldset className="quiz-question__fieldset" disabled={checked}>
        <legend className="quiz-question__text">{question.question}</legend>
        <div className="options">
          {question.options.map((option, index) => (
            <label key={option} className={optionClass(option)}>
              <input
                type="radio"
                name={groupName}
                value={option}
                checked={selected === option}
                onChange={() => setSelected(option)}
                className="option__input"
              />
              <span className="option__letter" aria-hidden="true">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="option__text">{option}</span>
              {checked && option === question.correct_answer && (
                <CheckIcon className="option__mark" aria-label="Correct answer" />
              )}
              {checked && option === selected && option !== question.correct_answer && (
                <XIcon className="option__mark" aria-label="Your answer" />
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {checked && (
        <div
          className={`feedback ${isCorrect ? 'feedback--correct' : 'feedback--incorrect'}`}
          role="status"
        >
          <p className="feedback__verdict">
            {isCorrect ? 'Correct!' : `Not quite. The answer is “${question.correct_answer}”.`}
          </p>
          <p className="feedback__explanation">{question.explanation}</p>
        </div>
      )}

      <div className="quiz-question__actions">
        {checked ? (
          <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
            {isLast ? 'See my score' : 'Next question'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={check}
            disabled={selected === null}
          >
            Check answer
          </button>
        )}
      </div>
    </div>
  )
}
