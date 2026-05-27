// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { useViewStore, ViewSwitcher, ViewContainer } from '../src/renderer/components/ViewSwitcher'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

describe('ViewStore', () => {
  beforeEach(() => {
    useViewStore.setState({ currentView: 'chat', viewHistory: ['chat'] })
  })

  it('starts at chat', () => {
    expect(useViewStore.getState().currentView).toBe('chat')
  })

  it('navigates to a new view', () => {
    useViewStore.getState().navigate('settings')
    expect(useViewStore.getState().currentView).toBe('settings')
  })

  it('tracks view history', () => {
    useViewStore.getState().navigate('skills')
    useViewStore.getState().navigate('tools')
    expect(useViewStore.getState().viewHistory).toEqual(['chat', 'skills', 'tools'])
  })

  it('goBack returns to previous view', () => {
    useViewStore.getState().navigate('settings')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('chat')
  })

  it('goBack does nothing when at root', () => {
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('chat')
  })

  it('supports all view IDs', () => {
    const views = ['chat', 'settings', 'advanced-settings', 'provider-config', 'skills', 'tools', 'agent-config', 'mcp-servers', 'shortcuts', 'search', 'files'] as const
    for (const v of views) {
      useViewStore.getState().navigate(v)
      expect(useViewStore.getState().currentView).toBe(v)
    }
  })

  it('deep back navigation works', () => {
    useViewStore.getState().navigate('provider-config')
    useViewStore.getState().navigate('mcp-servers')
    useViewStore.getState().navigate('shortcuts')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('mcp-servers')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('provider-config')
    useViewStore.getState().goBack()
    expect(useViewStore.getState().currentView).toBe('chat')
  })
})

describe('ViewSwitcher', () => {
  it('renders children', () => {
    render(<ViewSwitcher><div>hello</div></ViewSwitcher>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})

describe('ViewContainer', () => {
  beforeEach(() => {
    useViewStore.setState({ currentView: 'chat', viewHistory: ['chat'] })
  })

  it('shows content when view matches', () => {
    render(<ViewContainer view="chat"><div>chat-view</div></ViewContainer>)
    expect(screen.getByText('chat-view')).toBeInTheDocument()
  })

  it('hides content when view does not match', () => {
    render(<ViewContainer view="settings"><div>settings-view</div></ViewContainer>)
    expect(screen.queryByText('settings-view')).toBeNull()
  })

  it('switches visibility on navigation', () => {
    const { rerender } = render(
      <>
        <ViewContainer view="chat"><div data-testid="chat-panel">chat</div></ViewContainer>
        <ViewContainer view="skills"><div data-testid="skills-panel">skills</div></ViewContainer>
      </>
    )
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('skills-panel')).toBeNull()

    useViewStore.getState().navigate('skills')
    rerender(
      <>
        <ViewContainer view="chat"><div data-testid="chat-panel">chat</div></ViewContainer>
        <ViewContainer view="skills"><div data-testid="skills-panel">skills</div></ViewContainer>
      </>
    )
    expect(screen.queryByTestId('chat-panel')).toBeNull()
    expect(screen.getByTestId('skills-panel')).toBeInTheDocument()
  })
})
