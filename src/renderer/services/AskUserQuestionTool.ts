export interface AskUserQuestion {
  id: string
  question: string
  options?: string[]
  requiresResponse: boolean
  answered: boolean
  response: string | null
  timestamp: number
}

export interface PendingQuestion {
  id: string
  question: string
  options?: string[]
  placeholder?: string
  required: boolean
}

export class AskUserQuestionTool {
  private pendingQuestions: AskUserQuestion[] = []
  private onQuestion?: (question: AskUserQuestion) => void
  private onAnswer?: (question: AskUserQuestion) => void

  setCallbacks(callbacks: {
    onQuestion?: (question: AskUserQuestion) => void
    onAnswer?: (question: AskUserQuestion) => void
  }) {
    this.onQuestion = callbacks.onQuestion
    this.onAnswer = callbacks.onAnswer
  }

  ask(question: string, options?: string[], requiresResponse = false): Promise<string | null> {
    return new Promise((resolve) => {
      const q: AskUserQuestion = {
        id: `ask-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        question,
        options,
        requiresResponse,
        answered: false,
        response: null,
        timestamp: Date.now(),
      }

      this.pendingQuestions.push(q)
      this.onQuestion?.(q)

      const checkAnswer = () => {
        const answered = this.pendingQuestions.find((pq) => pq.id === q.id && pq.answered)
        if (answered) {
          resolve(answered.response)
        } else {
          setTimeout(checkAnswer, 100)
        }
      }
      checkAnswer()
    })
  }

  answer(id: string, response: string) {
    const question = this.pendingQuestions.find((q) => q.id === id)
    if (question) {
      question.answered = true
      question.response = response
      this.onAnswer?.(question)
    }
  }

  getPendingQuestions(): AskUserQuestion[] {
    return this.pendingQuestions.filter((q) => !q.answered)
  }

  getAllQuestions(): AskUserQuestion[] {
    return this.pendingQuestions
  }

  clear() {
    this.pendingQuestions = []
  }
}

export function createAskUserQuestionTool(): AskUserQuestionTool {
  return new AskUserQuestionTool()
}
