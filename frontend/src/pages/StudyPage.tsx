import { useRef, useState } from 'react'
import { ChatPanel } from '../components/ChatPanel'
import { DocumentBar } from '../components/DocumentBar'
import { QuizPanel } from '../components/QuizPanel'
import { UploadCard } from '../components/UploadCard'
import { askQuestion, errorMessage, generateQuiz } from '../services/api'
import type { ChatMessage, QuizState, StudyDocument } from '../types/app'
import { nextId } from '../utils/id'

type View = 'chat' | 'quiz'

export function StudyPage() {
  const [document, setDocument] = useState<StudyDocument | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const [quiz, setQuiz] = useState<QuizState>({ status: 'idle' })

  // Refs guard against double-submits and drop responses for a document that was replaced.
  const activeDocId = useRef<string | null>(null)
  const askInFlight = useRef(false)
  const quizInFlight = useRef(false)
  const quizCounter = useRef(0)

  function handleUploaded(uploaded: StudyDocument) {
    activeDocId.current = uploaded.docId
    setDocument(uploaded)
    setReplacing(false)
    setView('chat')
    setMessages([])
    setAsking(false)
    askInFlight.current = false
    setQuiz({ status: 'idle' })
    quizInFlight.current = false
  }

  async function handleAsk(question: string) {
    if (!document || askInFlight.current) return
    const docId = document.docId
    askInFlight.current = true
    setAsking(true)
    setMessages((prev) => [...prev, { id: nextId('q'), role: 'user', text: question }])

    let reply: ChatMessage
    try {
      const answer = await askQuestion(docId, question)
      reply = { id: nextId('a'), role: 'assistant', parts: answer.parts }
    } catch (error) {
      reply = { id: nextId('e'), role: 'error', text: errorMessage(error), retryQuestion: question }
    }
    if (activeDocId.current !== docId) return
    setMessages((prev) => [...prev, reply])
    askInFlight.current = false
    setAsking(false)
  }

  async function handleQuiz() {
    if (!document || quizInFlight.current) return
    const docId = document.docId
    quizInFlight.current = true
    setView('quiz')
    setQuiz({ status: 'loading' })
    try {
      const result = await generateQuiz(docId)
      if (activeDocId.current !== docId) return
      quizCounter.current += 1
      setQuiz({ status: 'ready', questions: result.questions, quizId: quizCounter.current })
    } catch (error) {
      if (activeDocId.current !== docId) return
      setQuiz({ status: 'error', message: errorMessage(error) })
    } finally {
      if (activeDocId.current === docId) quizInFlight.current = false
    }
  }

  function handleQuizButton() {
    // Resume an existing quiz instead of paying for a new one; "Generate new quiz" makes a fresh one.
    if (quiz.status === 'ready' || quiz.status === 'loading') {
      setView('quiz')
      return
    }
    void handleQuiz()
  }

  if (!document || replacing) {
    return (
      <main className="page" id="main">
        {!document && (
          <section className="hero">
            <h1 className="hero__title">StudyBuddy AI</h1>
            <p className="hero__subtitle">
              Upload your lecture notes, ask questions, and practice smarter.
            </p>
            <ol className="steps" aria-label="How it works">
              <li className="steps__item">
                <span className="steps__num">1</span> Upload a lecture PDF
              </li>
              <li className="steps__item">
                <span className="steps__num">2</span> Ask questions, get cited answers
              </li>
              <li className="steps__item">
                <span className="steps__num">3</span> Quiz yourself
              </li>
            </ol>
          </section>
        )}
        <UploadCard
          onUploaded={handleUploaded}
          onCancel={document ? () => setReplacing(false) : undefined}
        />
      </main>
    )
  }

  return (
    <main className="page page--study" id="main">
      <DocumentBar
        document={document}
        quizBusy={quiz.status === 'loading' && view === 'quiz'}
        onReplace={() => setReplacing(true)}
        onQuiz={handleQuizButton}
      />
      {/* Chat stays mounted (just hidden) so history and drafts survive switching to the quiz. */}
      <div hidden={view !== 'chat'}>
        <ChatPanel
          filename={document.filename}
          messages={messages}
          pending={asking}
          onAsk={(question) => void handleAsk(question)}
        />
      </div>
      {view === 'quiz' && (
        <QuizPanel
          quiz={quiz}
          onNewQuiz={() => void handleQuiz()}
          onBackToChat={() => setView('chat')}
        />
      )}
    </main>
  )
}
