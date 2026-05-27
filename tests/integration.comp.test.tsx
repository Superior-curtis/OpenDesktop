// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { IpcError, ipcCall, safeIpcCall, electronAvailable } from '../src/renderer/services/IpcClient'
import { useViewStore, ViewContainer } from '../src/renderer/components/ViewSwitcher'
import { Skeleton, MessageSkeleton, SidebarSkeleton, ToolCallSkeleton } from '../src/renderer/components/Skeleton'

describe('IpcClient', () => {
  it('reports electron availability', () => {
    expect(electronAvailable()).toBe(true)
  })

  it('ipcCall resolves successful calls', async () => {
    const result = await ipcCall(() => Promise.resolve('ok'), { timeout: 5000 })
    expect(result).toBe('ok')
  })

  it('ipcCall rejects on timeout', async () => {
    await expect(
      ipcCall(() => new Promise((r) => setTimeout(r, 100)), { timeout: 10 }),
    ).rejects.toThrow('IPC timeout')
  })

  it('ipcCall retries on failure', async () => {
    let attempts = 0
    const result = await ipcCall(() => {
      attempts++
      if (attempts < 2) throw new Error('temporary')
      return Promise.resolve('recovered')
    }, { timeout: 5000, retries: 2 })
    expect(result).toBe('recovered')
    expect(attempts).toBe(2)
  })

  it('ipcCall throws after exhausting retries', async () => {
    await expect(
      ipcCall(() => Promise.reject(new Error('persistent')), { timeout: 5000, retries: 1 }),
    ).rejects.toThrow('IPC call failed')
  })

  it('safeIpcCall returns fallback on failure', async () => {
    const result = await safeIpcCall('fallback', () => Promise.reject(new Error('fail')), { timeout: 100, retries: 0 })
    expect(result).toBe('fallback')
  })
})

describe('ViewSwitcher', () => {
  beforeEach(() => {
    useViewStore.setState({ currentView: 'chat', viewHistory: ['chat'] })
  })

  it('starts on chat view', () => {
    const state = useViewStore.getState()
    expect(state.currentView).toBe('chat')
    expect(state.viewHistory).toEqual(['chat'])
  })

  it('navigates to new view', () => {
    useViewStore.getState().navigate('settings')
    const state = useViewStore.getState()
    expect(state.currentView).toBe('settings')
    expect(state.viewHistory).toEqual(['chat', 'settings'])
  })

  it('goBack returns to previous view', () => {
    useViewStore.getState().navigate('skills')
    useViewStore.getState().navigate('tools')
    expect(useViewStore.getState().currentView).toBe('tools')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('skills')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('chat')
  })

  it('goBack does nothing at root', () => {
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('chat')
    expect(useViewStore.getState().viewHistory).toEqual(['chat'])
  })

  it('ViewContainer shows children only when active', () => {
    const { rerender } = render(
      <ViewContainer view="chat"><div data-testid="content">Chat View</div></ViewContainer>,
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()

    useViewStore.getState().navigate('settings')
    rerender(
      <ViewContainer view="chat"><div data-testid="content">Chat View</div></ViewContainer>,
    )
    expect(screen.queryByTestId('content')).not.toBeInTheDocument()
  })
})

describe('Skeleton components', () => {
  it('renders Skeleton with custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-full" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-shimmer')
    expect(el.className).toContain('h-10')
    expect(el.className).toContain('w-full')
  })

  it('renders MessageSkeleton', () => {
    const { container } = render(<MessageSkeleton />)
    const circles = container.querySelectorAll('.rounded-full')
    expect(circles.length).toBeGreaterThanOrEqual(1)
  })

  it('renders SidebarSkeleton', () => {
    const { container } = render(<SidebarSkeleton />)
    const items = container.querySelectorAll('.rounded')
    expect(items.length).toBeGreaterThanOrEqual(8)
  })

  it('renders ToolCallSkeleton', () => {
    const { container } = render(<ToolCallSkeleton />)
    const items = container.querySelectorAll('.rounded')
    expect(items.length).toBeGreaterThanOrEqual(3)
  })
})