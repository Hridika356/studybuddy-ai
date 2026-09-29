import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import * as api from '../services/api'
import type { AskResponse, QuizQuestion } from '../types/api'
import { StudyPage } from './StudyPage'

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>()
  return {
    ...actual,
    uploadPdf: vi.fn(),
    askQuestion: vi.fn(),
    generateQuiz: vi.fn(),
  }
})

const mockedApi = vi.mocked(api)

const QUESTIONS: QuizQuestion[] = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i + 1}?`,
  options: [`Right ${i + 1}`, `Wrong A${i + 1}`, `Wrong B${i + 1}`, `Wrong C${i + 1}`],
  correct_answer: `Right ${i + 1}`,
  explanation: `Explanation ${i + 1}.`,
}))

async function uploadLecture(user: ReturnType<typeof userEvent.setup>) {
  mockedApi.uploadPdf.mockResolvedValue({ doc_id: 'doc123', filename: 'lecture1.pdf', page_count: 12 })
  const input = screen.getByLabelText(/drag & drop a pdf/i)
  await user.upload(input, new File(['%PDF-1.4'], 'lecture1.pdf', { type: 'application/pdf' }))
  await screen.findByText('lecture1.pdf')
}

describe('StudyPage main flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the landing message before upload', () => {
    render(<StudyPage />)
    expect(screen.getByRole('heading', { name: 'StudyBuddy AI' })).toBeInTheDocument()
    expect(
      screen.getByText('Upload your lecture notes, ask questions, and practice smarter.'),
    ).toBeInTheDocument()
  })

  it('rejects non-PDF files on the client without calling the API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<StudyPage />)
    await user.upload(
      screen.getByLabelText(/drag & drop a pdf/i),
      new File(['hello'], 'notes.txt', { type: 'text/plain' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a PDF/i)
    expect(mockedApi.uploadPdf).not.toHaveBeenCalled()
  })

  it('shows upload errors from the server', async () => {
    const user = userEvent.setup()
    mockedApi.uploadPdf.mockRejectedValue(
      new api.ApiError('invalid_pdf', 'This PDF appears to be damaged.', 400),
    )
    render(<StudyPage />)
    await user.upload(
      screen.getByLabelText(/drag & drop a pdf/i),
      new File(['%PDF'], 'broken.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('This PDF appears to be damaged.')
  })

  it('uploads, asks a question, and renders citation chips', async () => {
    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    expect(screen.getByText(/12 pages/)).toBeInTheDocument()

    let resolveAnswer!: (value: AskResponse) => void
    mockedApi.askQuestion.mockReturnValue(
      new Promise((resolve) => {
        resolveAnswer = resolve
      }),
    )

    const input = screen.getByLabelText('Your question')
    const send = screen.getByRole('button', { name: /ask/i })
    expect(send).toBeDisabled() // empty input

    await user.type(input, 'What is a stack?{Enter}')
    expect(mockedApi.askQuestion).toHaveBeenCalledWith('doc123', 'What is a stack?', [])
    expect(screen.getByText('Reading your notes…')).toBeInTheDocument()

    // A second Enter while waiting must not send a duplicate request.
    await user.type(input, 'Another?{Enter}')
    expect(mockedApi.askQuestion).toHaveBeenCalledTimes(1)

    resolveAnswer({
      parts: [
        { text: 'A stack follows LIFO.', pages: [4] },
        { text: ' A queue follows FIFO.', pages: [5, 6] },
      ],
    })

    const log = await screen.findByRole('log')
    await within(log).findByText('A stack follows LIFO.')
    expect(within(log).getByText('p. 4')).toBeInTheDocument()
    expect(within(log).getByText('p. 5–6')).toBeInTheDocument()
    expect(within(log).getByText('What is a stack?')).toBeInTheDocument()
  })

  it('shows an error with retry when asking fails', async () => {
    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)

    mockedApi.askQuestion
      .mockRejectedValueOnce(new api.ApiError('ai_busy', 'The AI service is busy right now.', 503))
      .mockResolvedValueOnce({ parts: [{ text: 'Recovered answer.', pages: [1] }] })

    await user.type(screen.getByLabelText('Your question'), 'Explain recursion{Enter}')
    expect(await screen.findByText('The AI service is busy right now.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Recovered answer.')).toBeInTheDocument()
    // The failed attempt has no answer, so it is not sent as history.
    expect(mockedApi.askQuestion).toHaveBeenLastCalledWith('doc123', 'Explain recursion', [])
  })

  it('runs a full quiz and scores it', async () => {
    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    mockedApi.generateQuiz.mockResolvedValue({ questions: QUESTIONS })

    await user.click(screen.getByRole('button', { name: /quiz me/i }))
    expect(mockedApi.generateQuiz).toHaveBeenCalledWith('doc123')

    // Answer 3 correctly, 2 incorrectly.
    for (let i = 0; i < 5; i += 1) {
      await screen.findByText(`Question ${i + 1} of 5`)
      // No feedback (and no answer reveal) before checking.
      expect(screen.queryByText(/Not quite|Correct!/)).not.toBeInTheDocument()
      const check = screen.getByRole('button', { name: 'Check answer' })
      expect(check).toBeDisabled()

      const choice = i < 3 ? `Right ${i + 1}` : `Wrong A${i + 1}`
      await user.click(screen.getByLabelText(new RegExp(choice)))
      await user.click(check)

      if (i < 3) {
        expect(screen.getByText('Correct!')).toBeInTheDocument()
      } else {
        expect(screen.getByText(/Not quite/)).toHaveTextContent(`Right ${i + 1}`)
      }
      expect(screen.getByText(`Explanation ${i + 1}.`)).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: i === 4 ? 'See my score' : 'Next question' }),
      )
    }

    expect(screen.getByRole('heading', { name: 'Your score: 3 / 5' })).toBeInTheDocument()

    // Retry reuses the same questions without another API call.
    await user.click(screen.getByRole('button', { name: /retry quiz/i }))
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument()
    expect(mockedApi.generateQuiz).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /back to chat/i }))
    expect(screen.getByLabelText('Your question')).toBeVisible()
  })

  it('shows a quiz error and allows trying again', async () => {
    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    mockedApi.generateQuiz
      .mockRejectedValueOnce(new api.ApiError('ai_malformed_response', 'Quiz failed.', 502))
      .mockResolvedValueOnce({ questions: QUESTIONS })

    await user.click(screen.getByRole('button', { name: /quiz me/i }))
    expect(await screen.findByText('Quiz failed.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Question 1 of 5')).toBeInTheDocument()
  })

  it('sends the previous question and answer as history on a follow-up', async () => {
    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    mockedApi.askQuestion
      .mockResolvedValueOnce({
        parts: [
          { text: 'A stack is LIFO.', pages: [2] },
          { text: ' Push adds to the top.', pages: [2] },
        ],
      })
      .mockResolvedValueOnce({ parts: [{ text: 'Like a stack of plates.', pages: [2] }] })

    const input = screen.getByLabelText('Your question')
    await user.type(input, 'What is a stack?{Enter}')
    await screen.findByText('A stack is LIFO.')
    await user.type(input, 'Give me an example{Enter}')
    await screen.findByText('Like a stack of plates.')

    expect(mockedApi.askQuestion).toHaveBeenNthCalledWith(1, 'doc123', 'What is a stack?', [])
    expect(mockedApi.askQuestion).toHaveBeenNthCalledWith(2, 'doc123', 'Give me an example', [
      { question: 'What is a stack?', answer: 'A stack is LIFO. Push adds to the top.' },
    ])
  })

  it('opens the uploaded PDF at the cited page when a citation chip is clicked', async () => {
    const originalCreate = URL.createObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-pdf')
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    onTestFinished(() => {
      URL.createObjectURL = originalCreate
      openSpy.mockRestore()
    })

    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    mockedApi.askQuestion.mockResolvedValue({ parts: [{ text: 'Load factor 0.75.', pages: [4] }] })
    await user.type(screen.getByLabelText('Your question'), 'When does it resize?{Enter}')

    const chip = await screen.findByRole('button', {
      name: 'Cited from page 4. Open the PDF at this page',
    })
    await user.click(chip)
    expect(openSpy).toHaveBeenCalledWith('blob:mock-pdf#page=4', '_blank')
  })

  it('renders plain (non-clickable) chips when no local file URL is available', async () => {
    // Node (under Vitest) provides URL.createObjectURL, so remove it to simulate an environment
    // without it; UploadCard's guard should then leave the chips non-clickable.
    const original = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', { value: undefined, configurable: true, writable: true })
    onTestFinished(() => {
      Object.defineProperty(URL, 'createObjectURL', { value: original, configurable: true, writable: true })
    })

    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    mockedApi.askQuestion.mockResolvedValue({ parts: [{ text: 'Cited.', pages: [3] }] })
    await user.type(screen.getByLabelText('Your question'), 'Q{Enter}')
    await screen.findByText('Cited.')
    expect(screen.queryByRole('button', { name: /Open the PDF/ })).not.toBeInTheDocument()
    expect(screen.getByText('p. 3')).toBeInTheDocument()
  })

  it('revokes the previous object URL when the PDF is replaced', async () => {
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    let n = 0
    URL.createObjectURL = vi.fn(() => `blob:pdf-${++n}`)
    const revoke = vi.fn()
    URL.revokeObjectURL = revoke
    onTestFinished(() => {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    })

    const user = userEvent.setup()
    render(<StudyPage />)
    await uploadLecture(user)
    expect(revoke).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Replace PDF' }))
    mockedApi.uploadPdf.mockResolvedValue({ doc_id: 'doc456', filename: 'week2.pdf', page_count: 3 })
    await user.upload(
      screen.getByLabelText(/drag & drop a pdf/i),
      new File(['%PDF-1.4'], 'week2.pdf', { type: 'application/pdf' }),
    )
    await screen.findByText('week2.pdf')
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:pdf-1')
  })
})
