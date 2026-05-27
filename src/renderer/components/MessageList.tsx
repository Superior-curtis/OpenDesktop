import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Message, RichMessage, MessagePart } from '../types'
import { User, Bot, Copy, Check, Pencil, RotateCcw, Brain, ChevronDown, ChevronUp, Hammer, FileText, RefreshCw, Layers, UserCheck, Trash2 } from 'lucide-react'
import { CodeBlock } from './CodeBlock'
import { VirtualList } from './VirtualList'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMarkdown(text: string, query: string): string {
  if (!query) return text
  try {
    const escaped = escapeRegExp(query)
    const re = new RegExp(`(${escaped})`, 'gi')
    return text.replace(re, '**$1**')
  } catch {
    return text
  }
}

interface MessageListProps {
  messages: (Message | RichMessage)[]
  onRegenerate?: () => void
  searchQuery?: string
}

export function MessageList({ messages, onRegenerate, searchQuery }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Bot className="w-7 h-7 text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500">Send a message to start</p>
        </div>
      </div>
    )
  }

  return (
    <VirtualList<(Message | RichMessage)>
      items={messages}
      estimatedItemHeight={120}
      overscan={3}
      containerClassName="flex-1"
      keyExtractor={(m) => m.id}
      renderItem={(message, index) => (
        <div className="max-w-3xl mx-auto px-4 py-3">
          <MessageItem
            message={message}
            isLast={index === messages.length - 1}
            onRegenerate={onRegenerate}
            searchQuery={searchQuery}
          />
        </div>
      )}
    />
  )
}

function MessageItem({
  message,
  isLast,
  onRegenerate,
  searchQuery,
}: {
  message: Message | RichMessage
  isLast: boolean
  onRegenerate?: () => void
  searchQuery?: string
}) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('content' in message ? message.content : message.parts.map(p => p.type === 'text' ? p.text : '').join('\n'))
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const isUser = message.role === 'user'

  // Support both flat Message and RichMessage
  const isRich = 'parts' in message && !('content' in message)
  const hasParts = isRich && (message as RichMessage).parts.length > 1
  const parts: MessagePart[] = hasParts ? (message as RichMessage).parts : []

  const getContent = () => {
    if (isRich) {
      const textParts = parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      return textParts.map(p => p.text).join('\n')
    }
    return (message as Message).content
  }

  const content = getContent()
  const contentLower = content.toLowerCase()
  const hasSearchMatch = searchQuery && contentLower.includes(searchQuery.toLowerCase())
  const hasThinking = content.includes('<thinking>') && content.includes('</thinking>')
  const thinkingContent = hasThinking
    ? content.match(/<thinking>([\s\S]*?)<\/thinking>/)?.[1] || ''
    : ''

  // Detect tool call blocks (uppercase <TOOL_CALLS>, lowercase <tool_call>, singular <TOOL_CALL>, etc.)
  const toolCallRegex = /<(?:TOOL_CALLS|tool_calls|tool_call|TOOL_CALL)>[\s\S]*?<\/(?:TOOL_CALLS|tool_calls|tool_call|TOOL_CALL)>/gi
  const hasToolCalls = toolCallRegex.test(content)
  toolCallRegex.lastIndex = 0
  const toolCallsContent = hasToolCalls
    ? (content.match(toolCallRegex) || []).join('\n')
    : ''

  let mainContent = content
  if (hasThinking) mainContent = mainContent.replace(/<thinking>[\s\S]*?<\/thinking>\n?/, '')
  if (hasToolCalls) mainContent = mainContent.replace(toolCallRegex, '').trim()
  const highlightedContent = useMemo(() => {
    if (!hasSearchMatch || !searchQuery) return mainContent
    return highlightMarkdown(mainContent, searchQuery)
  }, [mainContent, searchQuery, hasSearchMatch])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mainContent || content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      const { useChatStore } = require('../store/chatStore')
      useChatStore.getState().updateMessage(message.id, editContent)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(content)
    setIsEditing(false)
  }

  const renderParts = () => {
    if (!hasParts) {
      return (
        <div className="text-sm leading-relaxed prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match && typeof children === 'string' && !children.includes('\n')
                return isInline ? (
                  <code className="px-1 py-0.5 rounded bg-zinc-700 text-xs" {...props}>{children}</code>
                ) : (
                  <CodeBlock language={match?.[1] || ''}>{String(children)}</CodeBlock>
                )
              },
              strong({ children }) {
                if (hasSearchMatch && searchQuery) {
                  const text = typeof children === 'string' ? children : String(children)
                  if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return <mark className="bg-amber-500/30 text-amber-100 rounded px-0.5">{children}</mark>
                  }
                }
                return <strong>{children}</strong>
              },
              p({ children }) { return <p className="my-1.5">{children}</p> },
              ul({ children }) { return <ul className="my-1.5 list-disc pl-5">{children}</ul> },
              ol({ children }) { return <ol className="my-1.5 list-decimal pl-5">{children}</ol> },
              li({ children }) { return <li className="my-0.5">{children}</li> },
              pre({ children }) { return <>{children}</> },
            }}
          >
            {highlightedContent || mainContent || content}
          </ReactMarkdown>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {parts.map((part, idx) => {
          switch (part.type) {
            case 'text':
              return (
                <div key={idx} className="text-sm leading-relaxed prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && typeof children === 'string' && !children.includes('\n')
                        return isInline ? (
                          <code className="px-1 py-0.5 rounded bg-zinc-700 text-xs" {...props}>{children}</code>
                        ) : (
                          <CodeBlock language={match?.[1] || ''}>{String(children)}</CodeBlock>
                        )
                      },
                      strong({ children }) {
                        if (hasSearchMatch && searchQuery) {
                          const text = typeof children === 'string' ? children : String(children)
                          if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
                            return <mark className="bg-amber-500/30 text-amber-100 rounded px-0.5">{children}</mark>
                          }
                        }
                        return <strong>{children}</strong>
                      },
                      p({ children }) { return <p className="my-1.5">{children}</p> },
                      ul({ children }) { return <ul className="my-1.5 list-disc pl-5">{children}</ul> },
                      ol({ children }) { return <ol className="my-1.5 list-decimal pl-5">{children}</ol> },
                      li({ children }) { return <li className="my-0.5">{children}</li> },
                      pre({ children }) { return <>{children}</> },
                    }}
                  >
                    {hasSearchMatch && searchQuery ? highlightMarkdown(part.text, searchQuery) : part.text}
                  </ReactMarkdown>
                </div>
              )
            case 'reasoning':
              return (
                <div key={idx} className="p-2 rounded bg-purple-500/5 border border-purple-500/10 text-xs">
                  <div className="flex items-center gap-1.5 text-purple-400 mb-1">
                    <Brain className="w-3 h-3" />
                    <span>Reasoning</span>
                    {part.isSignature && <span className="text-zinc-500">(signature)</span>}
                  </div>
                  <pre className="text-zinc-400 whitespace-pre-wrap">{part.content.slice(0, 500)}</pre>
                </div>
              )
            case 'tool':
              if (part.state === 'pending' || part.state === 'running') {
                return (
                  <div key={idx} className="p-2 rounded bg-amber-500/5 border border-amber-500/10 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                      <Hammer className="w-3 h-3" />
                      <span className="font-mono">{part.toolName}</span>
                      <span className="text-zinc-500">call: {part.toolCallId.slice(0, 8)}</span>
                      <span className="text-zinc-600">({part.state})</span>
                    </div>
                    {part.input && <pre className="text-zinc-400 whitespace-pre-wrap">{JSON.stringify(part.input, null, 2)}</pre>}
                  </div>
                )
              }
              return (
                <div key={idx} className={`p-2 rounded text-xs ${part.state === 'error' ? 'bg-red-500/5 border border-red-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Hammer className={`w-3 h-3 ${part.state === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
                    <span className={part.state === 'error' ? 'text-red-400' : 'text-emerald-400'}>Tool {part.state === 'error' ? 'Error' : 'Result'}</span>
                    <span className="text-zinc-500">use: {part.toolCallId.slice(0, 8)}</span>
                  </div>
                  <pre className="text-zinc-400 whitespace-pre-wrap">{(part.result ?? part.error ?? '').slice(0, 500)}</pre>
                </div>
              )
            case 'file':
              return (
                <div key={idx} className="p-2 rounded bg-blue-500/5 border border-blue-500/10 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                    <FileText className="w-3 h-3" />
                    <span className="font-mono">{part.name ?? part.uri}</span>
                  </div>
                  {part.content && <pre className="text-zinc-400 whitespace-pre-wrap line-clamp-3">{part.content.slice(0, 200)}</pre>}
                </div>
              )
            case 'step-start':
              return (
                <div key={idx} className="flex items-center gap-2 p-1.5 text-xs text-zinc-400 border-l-2 border-zinc-600 ml-2">
                  <span>Step {part.step}</span>
                  {part.snapshot && <span className="text-zinc-500">(snapshot)</span>}
                </div>
              )
            case 'step-finish':
              return (
                <div key={idx} className="flex items-center gap-2 p-1.5 text-xs text-zinc-500 border-l-2 border-zinc-700 ml-2">
                  <span>Step {part.step} completed{part.finishReason ? `: ${part.finishReason}` : ''}</span>
                  {part.cost && <span>cost: {part.cost}</span>}
                </div>
              )
            case 'compaction':
              return (
                <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-zinc-800/30 text-xs text-zinc-500">
                  <Layers className="w-3 h-3" />
                  <span>Context compressed: {part.originalCount} → {part.compactedCount} messages, freed {part.tokensFreed} tokens</span>
                </div>
              )
            case 'retry':
              return (
                <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-amber-500/5 text-xs text-amber-400">
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry {part.attempt}/{part.maxRetries}: {part.error}</span>
                </div>
              )
            case 'agent':
              return (
                <div key={idx} className="p-2 rounded text-xs bg-zinc-700/30 border border-zinc-600/30">
                  <div className="flex items-center gap-1.5 text-zinc-300 mb-1">
                    <UserCheck className="w-3 h-3" />
                    <span className="font-medium">{part.name}</span>
                    {part.model && <span className="text-zinc-500">({part.model})</span>}
                  </div>
                  <pre className="text-zinc-400 whitespace-pre-wrap">{part.prompt.slice(0, 300)}</pre>
                </div>
              )
            default:
              return null
          }
        })}
      </div>
    )
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDelete = () => {
    const { useChatStore } = require('../store/chatStore')
    useChatStore.getState().deleteMessage(message.id)
    setContextMenu(null)
  }

  const handleRegenerate = () => {
    setContextMenu(null)
    onRegenerate?.()
  }

  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : ''}`} onContextMenu={handleContextMenu}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400'
      }`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      <div className={`flex-1 ${isUser ? 'max-w-[80%]' : 'max-w-[80%]'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-zinc-400">
            {isUser ? 'You' : message.provider || 'Assistant'}
          </span>
          {hasThinking && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">thought</span>
          )}
          <span className="text-[10px] text-zinc-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent} onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[80px] p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 resize-y"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-zinc-100 text-zinc-900 rounded text-xs hover:bg-white">Save</button>
              <button onClick={handleCancelEdit} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-700">Cancel</button>
            </div>
          </div>
        ) : (
          <div className={`rounded-lg px-4 py-3 ${
            isUser ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/50 border border-zinc-800 text-zinc-300'
          } ${hasSearchMatch ? 'ring-1 ring-amber-500/40' : ''}`}>
            {hasThinking && (
              <div className="mb-3">
                <button
                  onClick={() => setThinkingExpanded(!thinkingExpanded)}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
                >
                  <Brain className="w-3 h-3" />
                  <span>Thinking</span>
                  {thinkingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {thinkingExpanded && (
                  <div className="mt-2 p-3 rounded bg-purple-500/5 border border-purple-500/10 text-xs text-zinc-400 whitespace-pre-wrap">
                    {thinkingContent}
                  </div>
                )}
              </div>
            )}
            {hasToolCalls && (
              <div className="mb-3">
                <button
                  onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Hammer className="w-3 h-3" />
                  <span>Tool Calls</span>
                  {toolCallsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {toolCallsExpanded && (
                  <div className="mt-2 p-3 rounded bg-amber-500/5 border border-amber-500/10 text-xs text-zinc-400 whitespace-pre-wrap font-mono">
                    {toolCallsContent}
                  </div>
                )}
              </div>
            )}

            {renderParts()}
          </div>
        )}

        {!isEditing && (
          <div className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : ''}`}>
            <button onClick={handleCopy} className="p-1 hover:bg-zinc-800 rounded" title="Copy">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-500" />}
            </button>
            {isUser && (
              <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-zinc-800 rounded" title="Edit">
                <Pencil className="w-3 h-3 text-zinc-500" />
              </button>
            )}
            {!isUser && isLast && onRegenerate && (
              <button onClick={onRegenerate} className="p-1 hover:bg-zinc-800 rounded" title="Regenerate">
                <RotateCcw className="w-3 h-3 text-zinc-500" />
              </button>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 w-36 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl py-1"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { handleCopy(); setContextMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
              <Copy className="w-3 h-3" /> Copy
            </button>
            {isUser && (
              <button onClick={() => { setIsEditing(true); setContextMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            {!isUser && onRegenerate && (
              <button onClick={handleRegenerate} className="w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2">
                <RotateCcw className="w-3 h-3" /> Regenerate
              </button>
            )}
            <div className="border-t border-zinc-700 my-1" />
            <button onClick={handleDelete} className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
