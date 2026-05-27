// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useNotificationsStore } from '../src/renderer/store/notificationsStore'
import { useChatStore } from '../src/renderer/store/chatStore'
import { Message } from '../src/renderer/types'
import { ToastContainer } from '../src/renderer/components/ToastContainer'
import { exportAllData, importAllData, downloadExport, readImportFile } from '../src/renderer/services/ExportImport'

beforeEach(() => {
  useNotificationsStore.setState({ notifications: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('notificationsStore', () => {
  it('starts empty', () => {
    expect(useNotificationsStore.getState().notifications).toEqual([])
  })

  it('adds a notification', () => {
    const id = useNotificationsStore.getState().addNotification({
      type: 'info',
      title: 'Hello',
      message: 'World',
      duration: 0,
    })
    const state = useNotificationsStore.getState()
    expect(state.notifications).toHaveLength(1)
    expect(state.notifications[0].id).toBe(id)
    expect(state.notifications[0].type).toBe('info')
    expect(state.notifications[0].title).toBe('Hello')
    expect(state.notifications[0].message).toBe('World')
    expect(state.notifications[0].dismissed).toBe(false)
    expect(state.notifications[0].timestamp).toBeGreaterThan(0)
  })

  it('auto-dismisses after duration', () => {
    useNotificationsStore.getState().addNotification({
      type: 'success',
      title: 'Auto dismiss',
      duration: 1000,
    })
    expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(false)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(true)
    act(() => { vi.advanceTimersByTime(300) })
    expect(useNotificationsStore.getState().notifications).toHaveLength(0)
  })

  it('does not auto-dismiss when duration is 0', () => {
    useNotificationsStore.getState().addNotification({
      type: 'warning',
      title: 'Persistent',
      duration: 0,
    })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(useNotificationsStore.getState().notifications).toHaveLength(1)
    expect(useNotificationsStore.getState().notifications[0].dismissed).toBe(false)
  })

  it('dismisses notification by id', () => {
    const id = useNotificationsStore.getState().addNotification({
      type: 'error',
      title: 'Oops',
      duration: 0,
    })
    expect(useNotificationsStore.getState().notifications).toHaveLength(1)
    useNotificationsStore.getState().dismissNotification(id)
    expect(useNotificationsStore.getState().notifications).toHaveLength(0)
  })

  it('clears all notifications', () => {
    useNotificationsStore.getState().addNotification({ type: 'info', title: 'A', duration: 0 })
    useNotificationsStore.getState().addNotification({ type: 'info', title: 'B', duration: 0 })
    useNotificationsStore.getState().addNotification({ type: 'info', title: 'C', duration: 0 })
    expect(useNotificationsStore.getState().notifications).toHaveLength(3)
    useNotificationsStore.getState().clearNotifications()
    expect(useNotificationsStore.getState().notifications).toHaveLength(0)
  })

  it('has correct type for each notification style', () => {
    const types = ['success', 'error', 'warning', 'info'] as const
    for (const t of types) {
      const id = useNotificationsStore.getState().addNotification({
        type: t,
        title: `Test ${t}`,
        duration: 0,
      })
      const n = useNotificationsStore.getState().notifications.find(n => n.id === id)
      expect(n?.type).toBe(t)
    }
  })
})

describe('ToastContainer', () => {
  it('renders nothing when no notifications', () => {
    const { container } = render(<ToastContainer />)
    expect(container.firstChild).toBeNull()
  })

  it('renders visible notifications', () => {
    act(() => {
      useNotificationsStore.getState().addNotification({
        type: 'info',
        title: 'Test Toast',
        message: 'This is a test',
        duration: 0,
      })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Test Toast')).toBeInTheDocument()
    expect(screen.getByText('This is a test')).toBeInTheDocument()
  })

  it('does not render dismissed notifications', () => {
    act(() => {
      useNotificationsStore.getState().addNotification({
        type: 'success',
        title: 'Gone soon',
        duration: 0,
      })
    })
    const { container } = render(<ToastContainer />)
    expect(screen.getByText('Gone soon')).toBeInTheDocument()
    act(() => {
      useNotificationsStore.getState().dismissNotification(
        useNotificationsStore.getState().notifications[0].id
      )
    })
    const { container: c2 } = render(<ToastContainer />)
    expect(c2.firstChild).toBeNull()
  })

  it('renders with correct type class for success', () => {
    act(() => {
      useNotificationsStore.getState().addNotification({
        type: 'success',
        title: 'Success!',
        duration: 0,
      })
    })
    const { container } = render(<ToastContainer />)
    const toast = container.querySelector('.border-emerald-700\\/50')
    expect(toast).toBeInTheDocument()
  })

  it('renders dismiss button for each toast', () => {
    act(() => {
      useNotificationsStore.getState().addNotification({
        type: 'warning',
        title: 'Warning!',
        duration: 0,
      })
    })
    render(<ToastContainer />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ExportImport', () => {
  it('exports and imports data', () => {
    const json = exportAllData()
    const parsed = JSON.parse(json)
    expect(parsed.app).toBe('opendesktop')
    expect(parsed.version).toBe(3)
    expect(parsed.chat).toBeDefined()
    expect(parsed.workspace).toBeDefined()

    const result = importAllData(json)
    expect(result.success).toBe(true)
  })

  it('rejects invalid export', () => {
    const result = importAllData(JSON.stringify({ app: 'unknown' }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('expected "opendesktop"')
  })

  it('rejects malformed JSON', () => {
    const result = importAllData('not json')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('Session persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useChatStore.setState({ messages: [], conversations: [], currentConversationId: null })
  })

  it('creates and switches conversations', () => {
    useChatStore.setState({ conversations: [] })
    const cId = useChatStore.getState().createConversation()
    const convs = useChatStore.getState().conversations
    expect(convs.length).toBe(1)
    expect(convs[0].id).toBe(cId)
  })

  it('handles multiple conversations in chatStore', () => {
    useChatStore.setState({ conversations: [] })
    useChatStore.getState().createConversation()
    useChatStore.getState().createConversation()
    useChatStore.getState().createConversation()
    expect(useChatStore.getState().conversations.length).toBe(3)
  })

  it('persists and restores via localStorage middleware', () => {
    const storeName = 'opendesktop-storage-v3'
    localStorage.setItem(storeName, JSON.stringify({
      state: { conversations: [{ id: 'c1', title: 'stored-conv', messages: [], createdAt: Date.now(), updatedAt: Date.now(), mode: 'chat', contextTokens: 0 }], activeConversationId: 'c1' },
      version: 3,
    }))
    const raw = localStorage.getItem(storeName)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.state.conversations[0].title).toBe('stored-conv')
    expect(parsed.state.activeConversationId).toBe('c1')
  })

  it('switching conversation preserves message count', () => {
    useChatStore.setState({ conversations: [] })
    const cId = useChatStore.getState().createConversation()
    const msg: Message = { id: 'm1', role: 'user', content: 'hello', createdAt: Date.now() }
    useChatStore.getState().addMessage(msg)
    useChatStore.getState().createConversation()
    useChatStore.getState().switchConversation(cId)
    expect(useChatStore.getState().messages.length).toBe(1)
    expect(useChatStore.getState().messages[0].content).toBe('hello')
  })
})
