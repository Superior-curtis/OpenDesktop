import { useState, useEffect } from 'react'
import {
  AskUserQuestion,
  createAskUserQuestionTool,
} from '../services/AskUserQuestionTool'
import { MessageSquare, Send, AlertCircle } from 'lucide-react'

interface AskUserQuestionPanelProps {
  askUserTool: ReturnType<typeof createAskUserQuestionTool>
}

export function AskUserQuestionPanel({ askUserTool }: AskUserQuestionPanelProps) {
  const [questions, setQuestions] = useState<AskUserQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  useEffect(() => {
    askUserTool.setCallbacks({
      onQuestion: (question) => {
        setQuestions((prev) => [...prev, question])
      },
      onAnswer: (question) => {
        setQuestions((prev) => prev.filter((q) => q.id !== question.id))
      },
    })

    const interval = setInterval(() => {
      setQuestions(askUserTool.getPendingQuestions())
    }, 500)

    return () => clearInterval(interval)
  }, [askUserTool])

  const handleAnswer = (questionId: string) => {
    const answer = answers[questionId]
    if (answer) {
      askUserTool.answer(questionId, answer)
      setAnswers((prev) => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, questionId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAnswer(questionId)
    }
  }

  if (questions.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <div
          key={question.id}
          className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
              <span className="font-medium text-yellow-100">AI has a question</span>
            </div>
            <span className="text-xs text-yellow-500">
              {new Date(question.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-sm text-yellow-200 mb-3">{question.question}</p>

          {question.options && question.options.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [question.id]: option }))
                    handleAnswer(question.id)
                  }}
                  className="px-3 py-1.5 bg-yellow-800/30 border border-yellow-700/50 rounded-md text-sm text-yellow-200 hover:bg-yellow-800/50"
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                }
                onKeyDown={(e) => handleKeyPress(e, question.id)}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-zinc-100 text-sm resize-none"
                rows={2}
                placeholder="Type your response..."
              />
              <button
                onClick={() => handleAnswer(question.id)}
                disabled={!answers[question.id]?.trim()}
                className="p-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {question.requiresResponse && (
            <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
              <AlertCircle className="w-3 h-3" />
              <span>Response required before continuing</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
