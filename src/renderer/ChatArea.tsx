import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from './store/chatStore'
import { ApiClient } from './services/ApiClient'
import { ArrowUp, Square } from 'lucide-react'

export function ChatArea() {
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const {
    activeConversationId, messages,
    providers, activeProviderId,
    addMessage, updateMessage, createConversation,
  } = useChatStore()
  const activeProvider = providers.find((p: any) => p.id === activeProviderId)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    if (!streaming) inputRef.current?.focus()
  }, [streaming])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || !activeProvider) return

    if (!activeConversationId) createConversation()

    setInput('')
    setStreaming(true)
    setStreamingContent('')

    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: text, timestamp: Date.now() }
    addMessage(userMsg)

    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant' as const, content: '', timestamp: Date.now() }
    addMessage(assistantMsg)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const client = new ApiClient(activeProvider)
      const allMsgs = [...useChatStore.getState().messages]
      const stream = await client.chat(allMsgs, true)

      let fullContent = ''
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        if (typeof chunk === 'string') {
          fullContent += chunk
          setStreamingContent(fullContent)
          updateMessage(assistantMsg.id, fullContent)
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        updateMessage(assistantMsg.id, `Error: ${err.message || 'Unknown error'}`)
      }
    } finally {
      setStreaming(false)
      setStreamingContent('')
      abortRef.current = null
    }
  }, [input, streaming, activeProvider, activeConversationId])

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const displayMessages = messages || []

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {displayMessages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-3xl mb-6 font-light text-zinc-500">OpenDesktop</div>
            {activeProvider ? (
              <p className="text-sm text-zinc-600">How can I help you?</p>
            ) : (
              <p className="text-sm text-zinc-600">
                Add a provider in Settings to get started
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
            {displayMessages.map((msg: any) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role !== 'user' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-zinc-400">AI</span>
                  </div>
                )}
                <div className={`max-w-[85%] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tr-md px-4 py-2.5'
                    : 'text-zinc-300 px-1'
                }`}>
                  {(!msg.content && msg.role === 'assistant') ? (
                    <span className="text-zinc-600 italic">Thinking...</span>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming */}
            {streamingContent && (
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-zinc-400">AI</span>
                </div>
                <div className="text-sm leading-relaxed text-zinc-300 px-1">
                  <div className="whitespace-pre-wrap break-words">
                    {streamingContent}
                    <span className="inline-block w-1.5 h-3.5 bg-zinc-400 animate-pulse ml-0.5 align-middle rounded-sm" />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 focus-within:border-zinc-600 transition-all shadow-sm">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={activeProvider ? 'Ask anything...' : 'Add a provider in Settings first'}
              disabled={!activeProvider}
              rows={1}
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none py-0.5"
            />
            {streaming ? (
              <button
                onClick={handleStop}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0"
                title="Stop"
              >
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !activeProvider}
                className="p-1.5 rounded-lg bg-zinc-200 text-zinc-900 hover:bg-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-zinc-700 text-center mt-2">
            OpenDesktop — free &amp; open-source AI assistant
          </p>
        </div>
      </div>
    </div>
  )
}
