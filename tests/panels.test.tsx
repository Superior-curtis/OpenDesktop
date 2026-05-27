// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useChatStore } from '../src/renderer/store/chatStore'
import { useWorkspaceStore } from '../src/renderer/store/workspaceStore'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    conversations: [],
    activeConversationId: null,
    providers: [],
    settings: {
      theme: 'dark', autoSave: true, maxTokens: 4096, temperature: 0.7,
      fontSize: 'medium', sendShortcut: 'enter', mode: 'chat', systemPrompt: '',
      memories: [], mcpServers: [], autoUseMCP: true, thinking: { enabled: false, mode: 'simple', budget: 4096 },
      effort: 'medium', outputStyle: 'detailed', developerMode: false, permissionMode: 'ask',
    },
  })
})

describe('ChatSearchPanel', () => {
  it('renders search interface', async () => {
    const { ChatSearchPanel } = await import('../src/renderer/components/ChatSearchPanel')
    render(<ChatSearchPanel />)
    expect(screen.getByText('Search Chats')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search messages and conversations...')).toBeInTheDocument()
  })

  it('shows mode filter buttons', async () => {
    const { ChatSearchPanel } = await import('../src/renderer/components/ChatSearchPanel')
    render(<ChatSearchPanel />)
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByText('Conversations')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('filters messages by query', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'hello world', timestamp: 100 },
        { id: '2', role: 'assistant', content: 'hi there', timestamp: 200 },
        { id: '3', role: 'user', content: 'test message', timestamp: 300 },
      ],
    })
    const { ChatSearchPanel } = await import('../src/renderer/components/ChatSearchPanel')
    render(<ChatSearchPanel />)
    const input = screen.getByPlaceholderText('Search messages and conversations...')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(screen.getByText(/world/)).toBeInTheDocument()
    expect(screen.queryByText(/test message/)).not.toBeInTheDocument()
    expect(screen.queryByText(/hi there/)).not.toBeInTheDocument()
  })

  it('shows empty state when no matches', async () => {
    useChatStore.setState({
      messages: [
        { id: '1', role: 'user', content: 'hello', timestamp: 100 },
      ],
    })
    const { ChatSearchPanel } = await import('../src/renderer/components/ChatSearchPanel')
    render(<ChatSearchPanel />)
    const input = screen.getByPlaceholderText('Search messages and conversations...')
    fireEvent.change(input, { target: { value: 'nonexistent' } })
    expect(screen.getByText(/No messages match your search/)).toBeInTheDocument()
  })
})

describe('FileExplorer', () => {
  it('renders explorer tree title', async () => {
    const { FileExplorer } = await import('../src/renderer/components/FileExplorer')
    render(<FileExplorer />)
    expect(screen.getByText('Files')).toBeInTheDocument()
  })

  it('renders with refresh button', async () => {
    const { FileExplorer } = await import('../src/renderer/components/FileExplorer')
    render(<FileExplorer />)
    const refreshBtn = screen.getByTitle('Refresh')
    expect(refreshBtn).toBeInTheDocument()
  })
})

describe('VirtualList', () => {
  it('renders all items when small count', async () => {
    const { VirtualList } = await import('../src/renderer/components/VirtualList')
    const items = ['a', 'b', 'c']
    render(
      <div style={{ height: 400, overflowY: 'auto' }}>
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          renderItem={(item) => <div data-testid="item">{item as string}</div>}
        />
      </div>
    )
    expect(screen.getAllByTestId('item')).toHaveLength(3)
  })

  it('renders item content', async () => {
    const { VirtualList } = await import('../src/renderer/components/VirtualList')
    render(
      <div style={{ height: 400, overflowY: 'auto' }}>
        <VirtualList
          items={['hello world']}
          estimatedItemHeight={50}
          renderItem={(item) => <div>{item as string}</div>}
        />
      </div>
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('uses keyExtractor when provided', async () => {
    const { VirtualList } = await import('../src/renderer/components/VirtualList')
    const items = [{ id: 'x', val: 'test' }]
    render(
      <div style={{ height: 400, overflowY: 'auto' }}>
        <VirtualList
          items={items}
          estimatedItemHeight={50}
          keyExtractor={(item) => (item as { id: string }).id}
          renderItem={(item) => <div>{(item as { val: string }).val}</div>}
        />
      </div>
    )
    expect(screen.getByText('test')).toBeInTheDocument()
  })
})

describe('SessionTabs drag reorder', () => {
  it('reorders sessions correctly', () => {
    const getSessions = () => useWorkspaceStore.getState().sessions
    const { addSession, reorderSessions } = useWorkspaceStore.getState()
    const id1 = getSessions()[0].id
    addSession()
    const id2 = getSessions()[1].id
    addSession()
    const id3 = getSessions()[2].id

    expect(getSessions().map(s => s.id)).toEqual([id1, id2, id3])
    reorderSessions(0, 2)
    expect(getSessions().map(s => s.id)).toEqual([id2, id3, id1])
    reorderSessions(2, 0)
    expect(getSessions().map(s => s.id)).toEqual([id1, id2, id3])
  })
})
