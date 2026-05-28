import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ---------------------------------------------------------------------------
// FileEditTool
// ---------------------------------------------------------------------------
import {
  normalizeQuotes,
  findActualString,
  preserveQuoteStyle,
  validateEdit,
} from '@/renderer/services/FileEditTool'

describe('FileEditTool', () => {
  describe('normalizeQuotes', () => {
    it('converts left single curly quote to straight apostrophe', () => {
      expect(normalizeQuotes('\u2018hello')).toBe("'hello")
    })

    it('converts right single curly quote to straight apostrophe', () => {
      expect(normalizeQuotes('\u2019hello')).toBe("'hello")
    })

    it('converts left double curly quote to straight double quote', () => {
      expect(normalizeQuotes('\u201Chello')).toBe('"hello')
    })

    it('converts right double curly quote to straight double quote', () => {
      expect(normalizeQuotes('\u201Dhello')).toBe('"hello')
    })

    it('handles mixed curly quotes in a string', () => {
      const input = '\u201CHello\u201D \u2018world\u2019'
      expect(normalizeQuotes(input)).toBe('"Hello" \'world\'')
    })

    it('returns empty string for empty input', () => {
      expect(normalizeQuotes('')).toBe('')
    })

    it('returns the same string when no curly quotes present', () => {
      expect(normalizeQuotes('Hello world')).toBe('Hello world')
    })
  })

  describe('findActualString', () => {
    it('finds exact match directly', () => {
      const content = 'The quick brown fox'
      expect(findActualString(content, 'quick brown')).toBe('quick brown')
    })

    it('finds match with normalized curly quotes', () => {
      const content = 'Hello \u201Cworld\u201D here'
      expect(findActualString(content, '"world"')).toBe('\u201Cworld\u201D')
    })

    it('returns null when string is not found', () => {
      const content = 'The quick brown fox'
      expect(findActualString(content, 'lazy dog')).toBeNull()
    })

    it('returns null for empty content', () => {
      expect(findActualString('', 'something')).toBeNull()
    })

    it('handles content with only curly quotes matching straight', () => {
      const content = '\u201Ctest\u201D'
      expect(findActualString(content, '"test"')).toBe('\u201Ctest\u201D')
    })
  })

  describe('preserveQuoteStyle', () => {
    it('returns newString unchanged when oldString and actualOldString match', () => {
      expect(preserveQuoteStyle('hello', 'hello', 'world')).toBe('world')
    })

    it('preserves curly double quotes from actualOldString into newString opening', () => {
      const oldStr = '"hello"'
      const actualOld = '\u201Chello\u201D'
      const newStr = '"world"'
      const result = preserveQuoteStyle(oldStr, actualOld, newStr)
      expect(result.startsWith('\u201C')).toBe(true)
      expect(result.endsWith('"')).toBe(true)
    })

    it('preserves curly single quotes from actualOldString into newString opening', () => {
      const oldStr = "'hello'"
      const actualOld = '\u2018hello\u2019'
      const newStr = "'world'"
      const result = preserveQuoteStyle(oldStr, actualOld, newStr)
      expect(result.startsWith('\u2018')).toBe(true)
      expect(result.endsWith("'")).toBe(true)
    })

    it('returns newString unchanged if actualOldString has no curly quotes', () => {
      expect(preserveQuoteStyle('"a"', '"a"', '"b"')).toBe('"b"')
    })
  })

  describe('validateEdit', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      // Default mocks for window.api
      ;(globalThis as any).window = {
        api: {
          readFile: vi.fn(),
          writeFile: vi.fn(),
          executeCommand: vi.fn(),
        },
      }
    })

    it('rejects edits where old_string and new_string are identical', async () => {
      const result = await validateEdit({
        file_path: '/test/file.txt',
        old_string: 'same',
        new_string: 'same',
      })
      expect(result.result).toBe(false)
      expect(result.errorCode).toBe(1)
    })

    it('rejects edits where file has not been read yet', async () => {
      ;(window.api.readFile as any).mockResolvedValue('file content')
      ;(window.api.executeCommand as any).mockResolvedValue({ exitCode: 0, stdout: new Date().toISOString() })

      const result = await validateEdit({
        file_path: '/test/unread.txt',
        old_string: 'old',
        new_string: 'new',
      })
      expect(result.result).toBe(false)
      expect(result.errorCode).toBe(6)
    })
  })
})

// ---------------------------------------------------------------------------
// BashParser
// ---------------------------------------------------------------------------
import {
  parseShellCommand,
  classifyCommand,
  detectInjections,
} from '@/renderer/services/BashParser'

describe('BashParser', () => {
  describe('parseShellCommand', () => {
    it('parses a simple command with arguments', () => {
      const result = parseShellCommand('ls -la /tmp')
      expect(result.type).toBe('simple')
      expect(result.command).toBe('ls')
      expect(result.args).toEqual(['ls', '-la', '/tmp'])
    })

    it('parses commands connected by a pipe', () => {
      const result = parseShellCommand('ls -la | grep foo')
      expect(result.type).toBe('pipe')
      expect(result.commands).toBeDefined()
      expect(result.commands!.length).toBeGreaterThanOrEqual(2)
    })

    it('parses commands chained with &&', () => {
      const result = parseShellCommand('cd /tmp && ls -la')
      expect(result.type).toBe('chain')
      expect(result.chainOperator).toBe('&&')
    })

    it('returns empty command for empty input', () => {
      const result = parseShellCommand('')
      expect(result.type).toBe('simple')
      expect(result.command).toBe('')
    })

    it('returns empty command for whitespace-only input', () => {
      const result = parseShellCommand('   ')
      expect(result.type).toBe('simple')
      expect(result.command).toBe('')
    })
  })

  describe('classifyCommand', () => {
    it('marks rm -rf as dangerous', () => {
      const result = classifyCommand('rm -rf /some/dir')
      expect(result.risk).toBe('dangerous')
      expect(result.isDestructive).toBe(true)
    })

    it('marks ls as safe', () => {
      const result = classifyCommand('ls -la')
      expect(result.risk).toBe('safe')
      expect(result.isReadOnly).toBe(true)
    })

    it('marks empty command as safe', () => {
      const result = classifyCommand('')
      expect(result.risk).toBe('safe')
      expect(result.isReadOnly).toBe(true)
    })

    it('classifies dangerous commands like dd', () => {
      const result = classifyCommand('dd if=/dev/zero of=/dev/sda')
      expect(result.risk).toBe('dangerous')
    })
  })

  describe('detectInjections', () => {
    it('catches $(...) command substitution in args', () => {
      const result = detectInjections('echo $(cat /etc/passwd)')
      expect(result.hasInjection).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('catches backtick substitution in single-token command', () => {
      const result = detectInjections('`hostname`')
      expect(result.hasInjection).toBe(true)
    })

    it('returns no injection for clean command', () => {
      const result = detectInjections('ls -la')
      expect(result.hasInjection).toBe(false)
    })

    it('returns no injection for empty command', () => {
      const result = detectInjections('')
      expect(result.hasInjection).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// ModelManager
// ---------------------------------------------------------------------------
import { ModelManager } from '@/renderer/services/ModelManager'

describe('ModelManager', () => {
  let manager: ModelManager

  beforeEach(() => {
    manager = new ModelManager()
  })

  describe('resolveAlias', () => {
    it('finds model by alias', () => {
      const model = manager.resolveAlias('sonnet-4')
      expect(model).toBeDefined()
      expect(model!.id).toBe('claude-sonnet-4-20250514')
    })

    it('finds model by partial name match', () => {
      const model = manager.resolveAlias('sonnet')
      expect(model).toBeDefined()
      expect(model!.name.toLowerCase()).toContain('sonnet')
    })

    it('returns undefined for unknown model', () => {
      expect(manager.resolveAlias('nonexistent-model-xyz')).toBeUndefined()
    })
  })

  describe('getContextWindow', () => {
    it('returns correct context window size for Claude Sonnet 4', () => {
      expect(manager.getContextWindow('claude-sonnet-4-20250514')).toBe(200000)
    })

    it('returns correct context window size for GPT-4o', () => {
      expect(manager.getContextWindow('gpt-4o')).toBe(128000)
    })

    it('returns default 4096 for unknown model', () => {
      expect(manager.getContextWindow('unknown')).toBe(4096)
    })
  })

  describe('supportsThinking', () => {
    it('returns true for thinking-capable models', () => {
      expect(manager.supportsThinking('claude-sonnet-4-20250514')).toBe(true)
    })

    it('returns false for models without thinking capability', () => {
      expect(manager.supportsThinking('gpt-4o')).toBe(false)
    })

    it('returns false for unknown model', () => {
      expect(manager.supportsThinking('unknown')).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// PermissionSystem
// ---------------------------------------------------------------------------
import {
  checkToolPermission,
  permissionRuleFromString,
  type PermissionContext,
  type PermissionDecision,
} from '@/renderer/services/PermissionSystem'

function makeContext(overrides: Partial<PermissionContext> = {}): PermissionContext {
  return {
    mode: 'default',
    alwaysAllowRules: {},
    alwaysDenyRules: {},
    alwaysAskRules: {},
    shouldAvoidPermissionPrompts: false,
    ...overrides,
  }
}

describe('PermissionSystem', () => {
  describe('checkToolPermission', () => {
    it('denies tool when it matches alwaysDeny rules', async () => {
      const ctx = makeContext({
        mode: 'default',
        alwaysDenyRules: { session: ['Bash'] },
      })
      const result = await checkToolPermission({
        toolName: 'Bash',
        input: {},
        context: ctx,
        isReadOnly: false,
      })
      expect(result.behavior).toBe('deny')
    })

    it('allows tool when it matches alwaysAllow rules', async () => {
      const ctx = makeContext({
        mode: 'default',
        alwaysAllowRules: { session: ['Read'] },
      })
      const result = await checkToolPermission({
        toolName: 'Read',
        input: {},
        context: ctx,
        isReadOnly: true,
      })
      expect(result.behavior).toBe('allow')
    })

    it('allows all tools in bypassPermissions mode', async () => {
      const ctx = makeContext({
        mode: 'bypassPermissions',
      })
      const result = await checkToolPermission({
        toolName: 'Bash',
        input: { command: 'rm -rf /' },
        context: ctx,
        isReadOnly: false,
        isDestructive: true,
      })
      expect(result.behavior).toBe('allow')
    })

    it('denies destructive tools in plan mode', async () => {
      const ctx = makeContext({
        mode: 'plan',
      })
      const result = await checkToolPermission({
        toolName: 'Edit',
        input: {},
        context: ctx,
        isReadOnly: false,
        isDestructive: true,
      })
      expect(result.behavior).toBe('deny')
    })

    it('allows read-only tools in plan mode', async () => {
      const ctx = makeContext({ mode: 'plan' })
      const result = await checkToolPermission({
        toolName: 'Read',
        input: {},
        context: ctx,
        isReadOnly: true,
      })
      expect(result.behavior).toBe('allow')
    })
  })

  describe('matchesTool', () => {
    it('matches exact tool names via alwaysAllow rules', async () => {
      const ctx = makeContext({
        alwaysAllowRules: { session: ['Grep'] },
      })
      const result = await checkToolPermission({
        toolName: 'Grep',
        input: {},
        context: ctx,
        isReadOnly: true,
      })
      expect(result.behavior).toBe('allow')
    })

    it('does not match tool names that are not in rules and is destructive', async () => {
      const ctx = makeContext({
        alwaysAllowRules: { session: ['Grep'] },
      })
      const result = await checkToolPermission({
        toolName: 'Bash',
        input: {},
        context: ctx,
        isReadOnly: false,
        isDestructive: true,
      })
      expect(result.behavior).toBe('ask')
    })
  })

  describe('permissionRuleFromString', () => {
    it('parses simple rule without content', () => {
      const rule = permissionRuleFromString('Bash')
      expect(rule.toolName).toBe('Bash')
      expect(rule.ruleContent).toBeUndefined()
    })

    it('parses rule with content in parentheses', () => {
      const rule = permissionRuleFromString('Write(path=/tmp)')
      expect(rule.toolName).toBe('Write')
      expect(rule.ruleContent).toBe('path=/tmp')
    })

    it('parses rule with empty parentheses', () => {
      const rule = permissionRuleFromString('Tool()')
      expect(rule.toolName).toBe('Tool')
      expect(rule.ruleContent).toBe('')
    })
  })
})

// ---------------------------------------------------------------------------
// CostTracker
// ---------------------------------------------------------------------------
import { calculateCost, formatCost, CostTracker } from '@/renderer/services/CostTracker'

describe('CostTracker', () => {
  describe('calculateCost', () => {
    it('computes correct cost for Claude Sonnet 4', () => {
      const cost = calculateCost(
        { inputTokens: 1000000, outputTokens: 100000 },
        'claude-sonnet-4-20250514',
      )
      // input: 1M * 3/1M = $3, output: 100K * 15/1M = $1.50
      expect(cost).toBeCloseTo(4.50, 2)
    })

    it('handles zero usage', () => {
      const cost = calculateCost({}, 'claude-sonnet-4-20250514')
      expect(cost).toBe(0)
    })

    it('handles empty object with no tokens', () => {
      const cost = calculateCost({ inputTokens: 0, outputTokens: 0 }, 'claude-sonnet-4-20250514')
      expect(cost).toBe(0)
    })
  })

  describe('formatCost', () => {
    it('formats small values correctly', () => {
      expect(formatCost(0.0005)).toBe('$0.00')
    })

    it('formats values below $0.01 with 4 decimal places', () => {
      expect(formatCost(0.005)).toBe('$0.0050')
    })

    it('formats values below $1 with 3 decimal places', () => {
      expect(formatCost(0.1234)).toBe('$0.123')
    })

    it('formats values below $100 with 2 decimal places', () => {
      expect(formatCost(12.345)).toBe('$12.35')
    })

    it('formats large values with 0 decimal places', () => {
      expect(formatCost(1234.56)).toBe('$1235')
    })
  })

  describe('trackChunk', () => {
    it('accumulates input tokens correctly', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('input', 100)
      tracker.trackChunk('input', 200)
      const usage = tracker.getCurrentUsage()
      expect(usage.inputTokens).toBe(300)
    })

    it('accumulates output tokens correctly', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('output', 50)
      tracker.trackChunk('output', 150)
      const usage = tracker.getCurrentUsage()
      expect(usage.outputTokens).toBe(200)
    })

    it('accumulates cache read tokens correctly', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('cache_read', 500)
      const usage = tracker.getCurrentUsage()
      expect(usage.cacheReadTokens).toBe(500)
    })

    it('accumulates cache creation tokens correctly', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('cache_creation', 300)
      const usage = tracker.getCurrentUsage()
      expect(usage.cacheCreationTokens).toBe(300)
    })

    it('thinking tokens also count as output tokens', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('thinking', 100)
      const usage = tracker.getCurrentUsage()
      expect(usage.thinkingTokens).toBe(100)
      expect(usage.outputTokens).toBe(100)
    })

    it('updates session totals', () => {
      const tracker = new CostTracker('claude-sonnet-4-20250514')
      tracker.trackChunk('input', 1000)
      tracker.trackChunk('output', 500)
      const session = tracker.getSessionUsage()
      expect(session.inputTokens).toBe(1000)
      expect(session.outputTokens).toBe(500)
    })
  })
})

// ---------------------------------------------------------------------------
// SessionStorage
// ---------------------------------------------------------------------------
import {
  createSession,
  appendMessage,
  loadSession,
} from '@/renderer/services/SessionStorage'

describe('SessionStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock crypto.randomUUID
    if (typeof globalThis.crypto === 'undefined') {
      ;(globalThis as any).crypto = {} as Crypto
    }
    (globalThis as any).crypto.randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001')

    // Mock localStorage
    const store: Record<string, string> = {}
    ;(globalThis as any).localStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
      get length() { return Object.keys(store).length },
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
      clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]) }),
    }
  })

  describe('createSession', () => {
    it('returns session metadata with correct properties', async () => {
      const meta = await createSession('claude-sonnet-4-20250514', '/test/project', 'Test Session')
      expect(meta).toBeDefined()
      expect(meta.sessionId).toBeTruthy()
      expect(meta.model).toBe('claude-sonnet-4-20250514')
      expect(meta.projectDir).toBe('/test/project')
      expect(meta.title).toBe('Test Session')
      expect(meta.turnCount).toBe(0)
    })

    it('generates a sessionId', async () => {
      const meta = await createSession('gpt-4o')
      expect(meta.sessionId).toBeTruthy()
      expect(typeof meta.sessionId).toBe('string')
    })

    it('uses default title when not provided', async () => {
      const meta = await createSession('gpt-4o')
      expect(meta.title).toBeTruthy()
    })
  })

  describe('appendMessage', () => {
    it('stores messages in localStorage', async () => {
      const meta = await createSession('gpt-4o')
      await appendMessage(meta.sessionId, {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      })
      const entries = await loadSession(meta.sessionId)
      expect(entries.length).toBeGreaterThanOrEqual(2)
      const userMsg = entries.find(e => e.type === 'user')
      expect(userMsg).toBeDefined()
      expect(userMsg!.content).toBe('Hello')
    })

    it('loadSession returns entries for valid session', async () => {
      const meta = await createSession('gpt-4o')
      await appendMessage(meta.sessionId, {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there',
        timestamp: Date.now(),
      })
      const entries = await loadSession(meta.sessionId)
      expect(entries.length).toBeGreaterThanOrEqual(2)
    })

    it('returns empty array for non-existent session', async () => {
      const entries = await loadSession('nonexistent')
      expect(entries).toEqual([])
    })
  })
})

// ---------------------------------------------------------------------------
// ApiRetry
// ---------------------------------------------------------------------------
import {
  getRetryDelay,
  shouldRetry,
  isRateLimitError,
  isAuthError,
} from '@/renderer/services/ApiRetry'

describe('ApiRetry', () => {
  describe('getRetryDelay', () => {
    it('increases with attempt number', () => {
      const delay1 = getRetryDelay(1)
      const delay2 = getRetryDelay(2)
      const delay3 = getRetryDelay(3)
      expect(delay2).toBeGreaterThanOrEqual(delay1)
      expect(delay3).toBeGreaterThanOrEqual(delay2)
    })

    it('has jitter (not purely deterministic)', () => {
      const delays = Array.from({ length: 10 }, () => getRetryDelay(3))
      const unique = new Set(delays)
      // With jitter, not all calls with the same attempt should produce the same delay
      expect(unique.size).toBeGreaterThan(1)
    })

    it('never exceeds max backoff of 32000 ms', () => {
      for (let i = 1; i <= 20; i++) {
        const delay = getRetryDelay(i)
        expect(delay).toBeLessThanOrEqual(40000) // 32000 + jitter cap
      }
    })

    it('returns a positive integer', () => {
      const delay = getRetryDelay(1)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(delay)).toBe(true)
    })
  })

  describe('shouldRetry', () => {
    it('returns false when max retries exceeded', () => {
      const result = shouldRetry(new Error('timeout'), 10, 10, 0)
      expect(result.willRetry).toBe(false)
      expect(result.reason).toBe('max_retries_exceeded')
    })

    it('returns false for auth errors', () => {
      const result = shouldRetry(new Error('401 Unauthorized'), 1, 10, 0)
      expect(result.willRetry).toBe(false)
      expect(result.reason).toBe('auth_error')
    })

    it('returns true for retryable errors within limit', () => {
      const result = shouldRetry(new Error('timeout'), 1, 10, 0)
      expect(result.willRetry).toBe(true)
    })

    it('returns false when consecutive 529 errors exceed max', () => {
      const result = shouldRetry(new Error('529 Service Unavailable'), 1, 10, 3)
      expect(result.willRetry).toBe(false)
      expect(result.reason).toBe('max_529_retries_exceeded')
    })
  })

  describe('isRateLimitError', () => {
    it('detects 429 status code in error message', () => {
      expect(isRateLimitError(new Error('HTTP 429 Too Many Requests'))).toBe(true)
    })

    it('detects 529 status code in error message', () => {
      expect(isRateLimitError(new Error('HTTP 529 Service Unavailable'))).toBe(true)
    })

    it('detects rate limit text in error message', () => {
      expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true)
    })

    it('detects too many requests text', () => {
      expect(isRateLimitError(new Error('too many requests'))).toBe(true)
    })

    it('returns false for non-rate-limit errors', () => {
      expect(isRateLimitError(new Error('not found'))).toBe(false)
    })

    it('returns false for non-Error inputs', () => {
      expect(isRateLimitError('string error')).toBe(false)
      expect(isRateLimitError(null)).toBe(false)
      expect(isRateLimitError(undefined)).toBe(false)
    })
  })

  describe('isAuthError', () => {
    it('detects 401 status code', () => {
      expect(isAuthError(new Error('401 Unauthorized'))).toBe(true)
    })

    it('detects auth keyword', () => {
      expect(isAuthError(new Error('authentication failed'))).toBe(true)
    })

    it('detects unauthorized keyword', () => {
      expect(isAuthError(new Error('unauthorized access'))).toBe(true)
    })

    it('detects api key keyword', () => {
      expect(isAuthError(new Error('invalid api key'))).toBe(true)
    })

    it('returns false for non-auth errors', () => {
      expect(isAuthError(new Error('timeout'))).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// ContextCompaction
// ---------------------------------------------------------------------------
import {
  estimateTokens,
  shouldAutoCompact,
  getAutoCompactThreshold,
  applyCollapsesIfNeeded,
} from '@/renderer/services/ContextCompaction'
import type { Message } from '@/renderer/types'

describe('ContextCompaction', () => {
  describe('estimateTokens', () => {
    it('estimates tokens from text length (4 chars ≈ 1 token)', () => {
      expect(estimateTokens('abcd')).toBe(1)
    })

    it('rounds up for partial token counts', () => {
      expect(estimateTokens('abcde')).toBe(2)
    })

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('estimates proportionally for longer text', () => {
      const text = 'a'.repeat(400)
      expect(estimateTokens(text)).toBe(100)
    })
  })

  describe('shouldAutoCompact', () => {
    function makeMessages(count: number, contentLength: number = 100): Message[] {
      const msgs: Message[] = []
      for (let i = 0; i < count; i++) {
        msgs.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: 'x'.repeat(contentLength),
          timestamp: Date.now() + i,
        })
      }
      return msgs
    }

    it('returns false when messages are well under the limit', () => {
      const msgs = makeMessages(5, 10)
      expect(shouldAutoCompact(msgs, 'sonnet', true)).toBe(false)
    })

    it('returns true when approaching the context limit', () => {
      // For 'sonnet': contextWindow=200000, maxOutput=8192, effective=191808
      // autoCompactThreshold = 191808 - 13000 = 178808
      // Need enough messages to exceed that
      const msgs = makeMessages(2000, 100)
      // 2000 messages * 100 chars / 4 = ~50000 tokens — still under
      const msgs2 = makeMessages(8000, 100)
      // 8000 * 100 / 4 = 200000 tokens — above threshold
      const result = shouldAutoCompact(msgs2, 'sonnet', true)
      expect(result).toBe(true)
    })

    it('returns false when auto-compact is disabled', () => {
      const msgs = makeMessages(10000, 200)
      expect(shouldAutoCompact(msgs, 'sonnet', false)).toBe(false)
    })

    it('returns false for empty messages', () => {
      expect(shouldAutoCompact([], 'sonnet', true)).toBe(false)
    })
  })

  describe('getAutoCompactThreshold', () => {
    it('returns a threshold less than the effective context window', () => {
      const threshold = getAutoCompactThreshold('sonnet')
      expect(threshold).toBeLessThan(200000)
      expect(threshold).toBeGreaterThan(0)
    })
  })

  describe('applyCollapsesIfNeeded', () => {
    function makeMessages(count: number, contentLength: number = 100): Message[] {
      const msgs: Message[] = []
      for (let i = 0; i < count; i++) {
        msgs.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: 'x'.repeat(contentLength),
          timestamp: Date.now() + i,
        })
      }
      return msgs
    }

    it('skips short conversations', () => {
      const msgs = makeMessages(5, 100)
      const result = applyCollapsesIfNeeded(msgs)
      expect(result.tokensFreed).toBe(0)
      expect(result.messages).toEqual(msgs)
    })

    it('truncates long tool outputs in old messages', () => {
      const msgs = makeMessages(40, 100)
      msgs[0] = {
        ...msgs[0],
        role: 'user',
        toolCallId: 'tool-1',
        content: 'x'.repeat(5000),
      }
      const result = applyCollapsesIfNeeded(msgs)
      expect(result.tokensFreed).toBeGreaterThan(0)
      expect(result.messages[0].content.length).toBeLessThan(5000)
    })

    it('truncates old thinking messages', () => {
      const msgs = makeMessages(40, 100)
      msgs[0] = { ...msgs[0], isThinking: true, content: 'thinking '.repeat(200) }
      const result = applyCollapsesIfNeeded(msgs)
      expect(result.tokensFreed).toBeGreaterThan(0)
    })
  })

  describe('getAutoCompactThreshold', () => {
    it('returns a threshold less than the effective context window', () => {
      const threshold = getAutoCompactThreshold('sonnet')
      expect(threshold).toBeLessThan(200000)
      expect(threshold).toBeGreaterThan(0)
    })
  })
})