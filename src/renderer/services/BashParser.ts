// ============================================================================
// Bash Parser Types
// Modeled after Claude Code's shell command parser for permission system
// ============================================================================

export type ShellCommandType = 'simple' | 'pipe' | 'chain' | 'subshell' | 'heredoc'

export interface ParsedRedirect {
  type: 'input' | 'output' | 'append' | 'error' | 'error-append' | 'heredoc'
  target: string
  fd?: number
}

export interface ParsedCommand {
  type: ShellCommandType
  command: string
  args: string[]
  isBackground: boolean
  redirects: ParsedRedirect[]
  heredocContent?: string
  commands?: ParsedCommand[]
  chainOperator?: '&&' | '||' | ';'
}

// ============================================================================
// Constants
// ============================================================================

const SAFE_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'grep', 'find', 'echo', 'printf',
  'pwd', 'date', 'which', 'whoami', 'printenv', 'env',
  'sort', 'uniq', 'wc', 'cut', 'tr', 'od', 'xxd', 'hexdump',
  'file', 'stat', 'du', 'df', 'realpath', 'readlink',
  'basename', 'dirname', 'dirname', 'expand', 'fmt',
  'nl', 'pr', 'fold', 'paste', 'join', 'comm', 'ptx', 'tsort',
  'seq', 'shuf', 'factor', 'numfmt',
  'yes', 'true', 'false', 'cal', 'ncal',
  'time', 'nproc', 'arch', 'uname', 'hostname', 'id',
  'who', 'w', 'users', 'groups', 'logname',
  'tput', 'stty', 'tty',
  'man', 'apropos', 'whatis', 'info',
  'type', 'command', 'hash', 'help',
  'xargs', 'tee', 'tee',
  'jq', 'yq', 'fx',
  'bat', 'ripgrep', 'rg', 'ag', 'ack', 'pt',
  'fzf', 'skim',
  'less', 'more', 'most',
  'diff', 'diff3', 'sdiff', 'cmp',
  'sha256sum', 'sha1sum', 'md5sum', 'cksum', 'sum',
  'tree',
])

const GIT_READ_ONLY_COMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'tag',
  'describe', 'rev-parse', 'rev-list', 'cherry',
  'name-rev', 'ls-files', 'ls-tree', 'cat-file',
  'diff-tree', 'diff-index', 'diff-files',
  'shortlog', 'stash list', 'stash show',
  'config --list', 'config --get', 'var',
  'help', 'version', 'check-ignore', 'check-attr',
  'check-mailmap', 'check-ref-format',
  'for-each-ref', 'count-objects',
  'verify-pack', 'verify-tag', 'verify-commit',
])

const GIT_DESTRUCTIVE_COMMANDS = new Set([
  'reset --hard', 'clean -fd', 'clean -xfd', 'clean -xffd',
  'branch -D', 'branch --delete --force',
  'tag -d', 'tag --delete',
  'push --force', 'push -f', 'push --mirror',
  'filter-branch', 'update-ref -d',
  'reflog expire', 'gc --prune',
  'cherry-pick --abort', 'revert --abort',
  'bisect reset',
])

const DANGEROUS_COMMANDS_SIMPLE = new Set([
  'mkfs', 'mkfs.ext4', 'mkfs.btrfs', 'mkfs.xfs', 'mkfs.fat',
  'format', 'dd',
  'shutdown', 'reboot', 'halt', 'poweroff',
])

const MODERATE_FLAGS_RM = new Set(['-rf', '-fr', '--recursive', '--force', '-r', '-f'])
const DESTRUCTIVE_RM_FLAGS = new Set(['-rf', '-fr', '--recursive', '--force'])

const SUSPICIOUS_PIPE_PATTERNS = [
  /(\|\s*(sh|bash|zsh|fish|pwsh|powershell|cmd|python|perl|ruby|node))\b/i,
  /(\|\s*base64\s*-d\b|\|\s*openssl\b)/i,
  /(\|\s*eval\b|\|\s*exec\b)/i,
  /(\|\s*wget\b|\|\s*curl\b)/i,
  /(\|\s*source\b|\|\s*\.\s)/i,
  /(\|\s*tee\s+\/dev\/(tcp|udp)\b)/i,
]

// ============================================================================
// Tokenizer
// ============================================================================

enum TokenType {
  Word = 'word',
  Pipe = 'pipe',
  And = 'and',
  Or = 'or',
  Semicolon = 'semicolon',
  Background = 'background',
  RedirectIn = 'redirectIn',
  RedirectOut = 'redirectOut',
  RedirectAppend = 'redirectAppend',
  RedirectErr = 'redirectErr',
  RedirectErrAppend = 'redirectErrAppend',
  RedirectHere = 'redirectHere',
  RedirectHereDash = 'redirectHereDash',
  SubshellStart = 'subshellStart',
  SubshellEnd = 'subshellEnd',
  BacktickStart = 'backtickStart',
  BacktickEnd = 'backtickEnd',
  Newline = 'newline',
}

interface Token {
  type: TokenType
  value: string
  pos: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++
      continue
    }

    if (ch === '\n') {
      tokens.push({ type: TokenType.Newline, value: '\n', pos: i })
      i++
      continue
    }

    if (ch === '|') {
      if (i + 1 < len && input[i + 1] === '|') {
        tokens.push({ type: TokenType.Or, value: '||', pos: i })
        i += 2
        continue
      }
      if (i + 1 < len && input[i + 1] === '&') {
        tokens.push({ type: TokenType.Pipe, value: '|&', pos: i })
        i += 2
        continue
      }
      tokens.push({ type: TokenType.Pipe, value: '|', pos: i })
      i++
      continue
    }

    if (ch === '&') {
      if (i + 1 < len && input[i + 1] === '&') {
        tokens.push({ type: TokenType.And, value: '&&', pos: i })
        i += 2
        continue
      }
      if (i + 1 < len && input[i + 1] !== ' ') {
        i++
        continue
      }
      tokens.push({ type: TokenType.Background, value: '&', pos: i })
      i++
      continue
    }

    if (ch === ';') {
      tokens.push({ type: TokenType.Semicolon, value: ';', pos: i })
      i++
      continue
    }

    if (ch === '>') {
      if (i + 1 < len && input[i + 1] === '>') {
        tokens.push({ type: TokenType.RedirectAppend, value: '>>', pos: i })
        i += 2
        continue
      }
      tokens.push({ type: TokenType.RedirectOut, value: '>', pos: i })
      i++
      continue
    }

    if (ch === '<') {
      if (i + 1 < len && input[i + 1] === '<') {
        if (i + 2 < len && input[i + 2] === '-') {
          tokens.push({ type: TokenType.RedirectHereDash, value: '<<-', pos: i })
          i += 3
          continue
        }
        tokens.push({ type: TokenType.RedirectHere, value: '<<', pos: i })
        i += 2
        continue
      }
      tokens.push({ type: TokenType.RedirectIn, value: '<', pos: i })
      i++
      continue
    }

    if (ch === '$' && i + 1 < len && input[i + 1] === '(') {
      tokens.push({ type: TokenType.SubshellStart, value: '$(', pos: i })
      i += 2
      continue
    }

    if (ch === ')') {
      tokens.push({ type: TokenType.SubshellEnd, value: ')', pos: i })
      i++
      continue
    }

    if (ch === '`') {
      tokens.push({ type: TokenType.BacktickStart, value: '`', pos: i })
      i++
      continue
    }

    if (/^\d$/.test(ch) && i + 1 < len && (input[i + 1] === '>' || input[i + 1] === '<')) {
      const fd = ch
      i++
      if (input[i] === '>') {
        if (i + 1 < len && input[i + 1] === '>') {
          tokens.push({ type: TokenType.RedirectErrAppend, value: `${fd}>>`, pos: i - 1 })
          i += 2
          continue
        }
        tokens.push({ type: TokenType.RedirectErr, value: `${fd}>`, pos: i - 1 })
        i++
        continue
      }
      tokens.push({ type: TokenType.RedirectIn, value: `${fd}<`, pos: i - 1 })
      i++
      continue
    }

    let word = ''
    const startPos = i

    while (i < len) {
      const c = input[i]

      if (c === '\\' && i + 1 < len) {
        word += input[i + 1]
        i += 2
        continue
      }

      if (c === '\'') {
        i++
        while (i < len && input[i] !== '\'') {
          if (input[i] === '\\' && i + 1 < len) {
            word += input[i + 1]
            i += 2
            continue
          }
          word += input[i]
          i++
        }
        if (i < len) i++
        continue
      }

      if (c === '"') {
        i++
        while (i < len && input[i] !== '"') {
          if (input[i] === '\\' && i + 1 < len) {
            const next = input[i + 1]
            if (next === '$' || next === '`' || next === '"' || next === '\\' || next === '!' || next === '\n') {
              word += next
            } else {
              word += '\\' + next
            }
            i += 2
            continue
          }
          if (input[i] === '`') {
            i++
            while (i < len && input[i] !== '`') {
              if (input[i] === '\\' && i + 1 < len) {
                word += input[i + 1]
                i += 2
                continue
              }
              word += input[i]
              i++
            }
            if (i < len) i++
            continue
          }
          word += input[i]
          i++
        }
        if (i < len) i++
        continue
      }

      if (c === '`') {
        tokens.push({ type: TokenType.BacktickStart, value: '`', pos: i })
        if (word) {
          tokens.push({ type: TokenType.Word, value: word, pos: startPos })
        }
        i++
        const backtickContent = tokenizeBacktick(input, i)
        tokens.push.apply(tokens, backtickContent.tokens)
        tokens.push({ type: TokenType.BacktickEnd, value: '`', pos: backtickContent.endPos })
        i = backtickContent.endPos + 1
        word = ''
        continue
      }

      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' ||
          c === '|' || c === '&' || c === ';' || c === '>' || c === '<' ||
          c === '(' || c === ')') {
        break
      }

      word += c
      i++
    }

    if (word) {
      tokens.push({ type: TokenType.Word, value: word, pos: startPos })
    }
  }

  return tokens
}

function tokenizeBacktick(input: string, start: number): { tokens: Token[], endPos: number } {
  const tokens: Token[] = []
  let i = start
  let word = ''
  const startPos = i

  while (i < input.length && input[i] !== '`') {
    const c = input[i]

    if (c === '\\' && i + 1 < input.length) {
      word += input[i + 1]
      i += 2
      continue
    }

    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      if (word) {
        tokens.push({ type: TokenType.Word, value: word, pos: startPos })
        word = ''
      }
      i++
      continue
    }

    if (c === '|') {
      if (word) {
        tokens.push({ type: TokenType.Word, value: word, pos: startPos })
        word = ''
      }
      tokens.push({ type: TokenType.Pipe, value: '|', pos: i })
      i++
      continue
    }

    word += c
    i++
  }

  if (word) {
    tokens.push({ type: TokenType.Word, value: word, pos: startPos })
  }

  return { tokens, endPos: i }
}

// ============================================================================
// Parser
// ============================================================================

function parseTokens(tokens: Token[]): ParsedCommand {
  if (tokens.length === 0) {
    return { type: 'simple', command: '', args: [], isBackground: false, redirects: [] }
  }

  const chainIndex = findChainOperator(tokens)
  if (chainIndex !== -1) {
    const leftTokens = tokens.slice(0, chainIndex)
    const rightTokens = tokens.slice(chainIndex + 1)
    const operator = tokens[chainIndex].value as '&&' | '||' | ';'

    const leftCmd = parseTokens(leftTokens)
    const rightCmd = parseTokens(rightTokens)

    return {
      type: 'chain',
      command: tokens.map(t => t.value).join(' '),
      args: [],
      isBackground: false,
      redirects: [],
      commands: [leftCmd, rightCmd],
      chainOperator: operator,
    }
  }

  const pipeIndex = findPipeOperator(tokens)
  if (pipeIndex !== -1) {
    const leftTokens = tokens.slice(0, pipeIndex)
    const rightTokens = tokens.slice(pipeIndex + 1)

    const leftCmd = parseTokens(leftTokens)
    const rightCmd = parseTokens(rightTokens)

    const allCmds = leftCmd.type === 'pipe'
      ? [...(leftCmd.commands || [leftCmd]), rightCmd]
      : [leftCmd, rightCmd]

    const isBg = leftCmd.isBackground || rightCmd.isBackground

    return {
      type: 'pipe',
      command: tokens.map(t => t.value).join(' '),
      args: [],
      isBackground: isBg,
      redirects: [...leftCmd.redirects, ...rightCmd.redirects],
      commands: allCmds,
    }
  }

  const subshellStartIndex = tokens.findIndex(t => t.type === TokenType.SubshellStart)
  if (subshellStartIndex !== -1) {
    return parseSubshell(tokens, subshellStartIndex)
  }

  return parseSimpleCommand(tokens)
}

function findChainOperator(tokens: Token[]): number {
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === TokenType.SubshellStart || t.type === TokenType.BacktickStart) depth++
    else if (t.type === TokenType.SubshellEnd || t.type === TokenType.BacktickEnd) depth--
    else if (depth === 0 && (t.type === TokenType.And || t.type === TokenType.Or || t.type === TokenType.Semicolon)) {
      return i
    }
  }
  return -1
}

function findPipeOperator(tokens: Token[]): number {
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === TokenType.SubshellStart || t.type === TokenType.BacktickStart) depth++
    else if (t.type === TokenType.SubshellEnd || t.type === TokenType.BacktickEnd) depth--
    else if (depth === 0 && t.type === TokenType.Pipe) return i
  }
  return -1
}

function parseSubshell(tokens: Token[], startIndex: number): ParsedCommand {
  const beforeTokens = tokens.slice(0, startIndex)
  const rest = tokens.slice(startIndex)

  let depth = 0
  let endIndex = -1
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].type === TokenType.SubshellStart) depth++
    else if (rest[i].type === TokenType.SubshellEnd) depth--
    if (depth === 0 && rest[i].type === TokenType.SubshellEnd) {
      endIndex = startIndex + i
      break
    }
  }

  let innerTokens: Token[] = []
  let afterTokens: Token[] = []
  let isBg = false
  let redirectTokens: Token[] = []

  if (endIndex !== -1) {
    innerTokens = tokens.slice(startIndex + 1, endIndex)
    afterTokens = tokens.slice(endIndex + 1)
  } else {
    innerTokens = tokens.slice(startIndex + 1)
  }

  let afterIdx = 0
  while (afterIdx < afterTokens.length && (afterTokens[afterIdx].type === TokenType.RedirectIn ||
         afterTokens[afterIdx].type === TokenType.RedirectOut ||
         afterTokens[afterIdx].type === TokenType.RedirectAppend ||
         afterTokens[afterIdx].type === TokenType.RedirectErr ||
         afterTokens[afterIdx].type === TokenType.RedirectErrAppend ||
         afterTokens[afterIdx].type === TokenType.RedirectHere ||
         afterTokens[afterIdx].type === TokenType.RedirectHereDash)) {
    redirectTokens.push(afterTokens[afterIdx])
    afterIdx++
    if (afterIdx < afterTokens.length && afterTokens[afterIdx].type === TokenType.Word) {
      redirectTokens.push(afterTokens[afterIdx])
      afterIdx++
    }
  }

  if (afterIdx < afterTokens.length && afterTokens[afterIdx].type === TokenType.Background) {
    isBg = true
    afterIdx++
  }

  const innerCmd = parseTokens(innerTokens)

  const redirects: ParsedRedirect[] = []
  for (let i = 0; i < redirectTokens.length; i++) {
    const rt = redirectTokens[i]
    const parsed = parseRedirectToken(rt, i + 1 < redirectTokens.length ? redirectTokens[i + 1] : undefined)
    if (parsed) {
      redirects.push(parsed)
      if (parsed.type === 'heredoc') i++
    }
  }

  const beforeCmd = beforeTokens.length > 0 ? parseTokens(beforeTokens) : undefined

  return {
    type: 'subshell',
    command: tokens.map(t => t.value).join(' '),
    args: [],
    isBackground: isBg,
    redirects,
    commands: beforeCmd ? [beforeCmd, innerCmd] : [innerCmd],
  }
}

function parseRedirectToken(token: Token, nextToken?: Token): ParsedRedirect | undefined {
  if (!nextToken || nextToken.type !== TokenType.Word) return undefined

  const target = nextToken.value
  const val = token.value

  if (val === '<') return { type: 'input', target }
  if (val === '>') return { type: 'output', target }
  if (val === '>>') return { type: 'append', target }
  if (val === '2>') return { type: 'error', target, fd: 2 }
  if (val === '2>>') return { type: 'error-append', target, fd: 2 }
  if (val === '<<') return { type: 'heredoc', target }
  if (val === '<<-') return { type: 'heredoc', target }

  const fdMatch = val.match(/^(\d+)([><].*)$/)
  if (fdMatch) {
    const fd = parseInt(fdMatch[1], 10)
    const op = fdMatch[2]
    if (op === '<') return { type: 'input', target, fd }
    if (op === '>') return { type: 'output', target, fd }
    if (op === '>>') return { type: 'append', target, fd }
  }

  return undefined
}

function parseSimpleCommand(tokens: Token[]): ParsedCommand {
  const args: string[] = []
  const redirects: ParsedRedirect[] = []
  let isBackground = false

  let heredocDelimiter: string | undefined
  let heredocStripIndent = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    if (t.type === TokenType.Word) {
      args.push(t.value)
      continue
    }

    if (t.type === TokenType.Background) {
      isBackground = true
      continue
    }

    if (t.type === TokenType.RedirectIn || t.type === TokenType.RedirectOut ||
        t.type === TokenType.RedirectAppend || t.type === TokenType.RedirectErr ||
        t.type === TokenType.RedirectErrAppend || t.type === TokenType.RedirectHere ||
        t.type === TokenType.RedirectHereDash) {
      const nextToken = i + 1 < tokens.length ? tokens[i + 1] : undefined
      if (!nextToken || nextToken.type !== TokenType.Word) continue

      if (t.type === TokenType.RedirectHere || t.type === TokenType.RedirectHereDash) {
        heredocDelimiter = nextToken.value
        heredocStripIndent = t.type === TokenType.RedirectHereDash
        i++
        continue
      }

      let redirectType: ParsedRedirect['type'] = 'output'
      let fd: number | undefined

      if (t.value === '<') redirectType = 'input'
      else if (t.value === '>') redirectType = 'output'
      else if (t.value === '>>') redirectType = 'append'
      else if (t.value === '2>') { redirectType = 'error'; fd = 2 }
      else if (t.value === '2>>') { redirectType = 'error-append'; fd = 2 }

      const fdMatch = t.value.match(/^(\d+)([><].*)$/)
      if (fdMatch) {
        fd = parseInt(fdMatch[1], 10)
        redirectType = fdMatch[2] === '>>' ? 'append' : fdMatch[2] === '<' ? 'input' : 'output'
      }

      redirects.push({ type: redirectType, target: nextToken.value, fd })
      i++
      continue
    }
  }

  const command = args[0] || ''

  if (heredocDelimiter) {
    return {
      type: 'heredoc',
      command,
      args,
      isBackground,
      redirects,
      heredocContent: extractHeredocContent(command, heredocDelimiter, heredocStripIndent),
    }
  }

  return {
    type: 'simple',
    command,
    args,
    isBackground,
    redirects,
  }
}

function extractHeredocContent(input: string, delimiter: string, stripIndent: boolean): string | undefined {
  const idx = input.indexOf(delimiter)
  if (idx === -1) return undefined

  let content = input.slice(idx + delimiter.length).trim()

  if (stripIndent) {
    const indent = content.length - content.replace(/^\t+/m, '').length
    content = content.split('\n').map(line => line.replace(new RegExp(`^\\t{1,${indent}}`), '')).join('\n')
  }

  return content
}

// ============================================================================
// Public parseShellCommand
// ============================================================================

export function parseShellCommand(input: string): ParsedCommand {
  const trimmed = input.trim()
  if (!trimmed) {
    return { type: 'simple', command: '', args: [], isBackground: false, redirects: [] }
  }

  const tokens = tokenize(trimmed)
  return parseTokens(tokens)
}

// ============================================================================
// classifyCommand
// ============================================================================

export interface CommandClassification {
  category: string
  risk: 'safe' | 'moderate' | 'dangerous'
  isReadOnly: boolean
  isDestructive: boolean
}

const READONLY_COMMANDS_LIST = `
- ls, cat, head, tail, grep, find, echo, pwd, date, which, whoami, printenv, env
- sort, uniq, wc, cut, tr, od, xxd, hexdump, file, stat, du, df
- diff, cmp, comm, join, fmt, nl, pr, fold, paste, ptx, tsort
- jq, yq, fx, bat, ripgrep, rg, ag, ack
- less, more, most, fzf, skim
- tree, basename, dirname, realpath, readlink, expand
- sha256sum, sha1sum, md5sum, cksum, sum, seq, shuf, factor
- true, false, yes, cal, ncal, time
- man, apropos, whatis, info, help
- type, command, hash
- xargs, tee
- git status, git log, git diff, git show, git branch, git tag (read-only git subcommands)
`

const DANGEROUS_COMMANDS_LIST = `
- rm -rf /, rm -rf *, rm -fr (recursive force delete)
- mkfs.* (filesystem creation)
- dd (disk destroyer)
- format (disk formatting)
- shutdown, reboot, halt, poweroff (system commands)
- mv with overwrite, cp with overwrite to system locations
- chmod -R 000, chown -R (recursive permission changes)
- git reset --hard, git clean -fd, git branch -D, git push --force
- > file, >> file (output redirects that overwrite/append files)
`

export function classifyCommand(command: string): CommandClassification {
  const trimmed = command.trim()
  if (!trimmed) {
    return { category: 'empty', risk: 'safe', isReadOnly: true, isDestructive: false }
  }

  const parsed = parseShellCommand(trimmed)

  if (parsed.type === 'chain') {
    if (!parsed.commands || parsed.commands.length === 0) {
      return { category: 'chain', risk: 'moderate', isReadOnly: false, isDestructive: false }
    }
    const classifications = parsed.commands.map(c => classifyCommand(c.command))
    const risks = classifications.map(c => c.risk)
    const overallRisk = risks.includes('dangerous') ? 'dangerous'
      : risks.includes('moderate') ? 'moderate'
      : 'safe'
    return {
      category: 'chain',
      risk: overallRisk,
      isReadOnly: classifications.every(c => c.isReadOnly),
      isDestructive: classifications.some(c => c.isDestructive),
    }
  }

  if (parsed.type === 'pipe') {
    if (!parsed.commands || parsed.commands.length === 0) {
      return { category: 'pipe', risk: 'moderate', isReadOnly: false, isDestructive: false }
    }
    const classifications = parsed.commands.map(c => classifyCommand(c.command))
    return {
      category: 'pipe',
      risk: classifications.some(c => c.risk === 'dangerous') ? 'dangerous'
        : classifications.some(c => c.risk === 'moderate') ? 'moderate'
        : 'safe',
      isReadOnly: classifications.every(c => c.isReadOnly),
      isDestructive: classifications.some(c => c.isDestructive),
    }
  }

  if (parsed.type === 'subshell') {
    return { category: 'subshell', risk: 'moderate', isReadOnly: false, isDestructive: false }
  }

  if (parsed.type === 'heredoc') {
    const base = classifyCommand(parsed.command)
    return {
      category: base.category,
      risk: base.risk === 'dangerous' ? 'dangerous' : 'moderate',
      isReadOnly: false,
      isDestructive: base.isDestructive,
    }
  }

  const baseCmd = parsed.command
  const baseLower = baseCmd.toLowerCase()
  const args = parsed.args.slice(1)

  if (baseLower === 'git') {
    return classifyGitCommand(args)
  }

  if (DANGEROUS_COMMANDS_SIMPLE.has(baseLower)) {
    return { category: baseLower, risk: 'dangerous', isReadOnly: false, isDestructive: true }
  }

  if (baseLower === 'rm') {
    return classifyRm(args)
  }

  if (baseLower === 'mv' || baseLower === 'cp') {
    const hasOverwrite = args.some(a => a === '-f' || a === '--force' || a === '-i' || a === '-b')
    return {
      category: baseLower,
      risk: hasOverwrite && args.length >= 3 ? 'dangerous' : 'moderate',
      isReadOnly: false,
      isDestructive: hasOverwrite && args.length >= 3,
    }
  }

  if (baseLower === 'chmod' || baseLower === 'chown') {
    const hasRecursive = args.some(a => a === '-R' || a === '--recursive')
    return {
      category: baseLower,
      risk: hasRecursive ? 'dangerous' : 'moderate',
      isReadOnly: false,
      isDestructive: hasRecursive,
    }
  }

  if (baseLower === 'npm' || baseLower === 'pip' || baseLower === 'cargo' || baseLower === 'gem') {
    return { category: baseLower, risk: 'moderate', isReadOnly: false, isDestructive: false }
  }

  if (baseLower === 'git') {
    return { category: 'git', risk: 'moderate', isReadOnly: false, isDestructive: false }
  }

  if (SAFE_COMMANDS.has(baseLower)) {
    return { category: baseLower, risk: 'safe', isReadOnly: true, isDestructive: false }
  }

  const hasOutputRedirect = parsed.redirects.some(r =>
    r.type === 'output' || r.type === 'append' || r.type === 'error' || r.type === 'error-append'
  )

  if (hasOutputRedirect) {
    if (baseLower && !SAFE_COMMANDS.has(baseLower)) {
      return { category: baseLower, risk: 'moderate', isReadOnly: false, isDestructive: false }
    }
  }

  return { category: baseLower || 'unknown', risk: 'moderate', isReadOnly: false, isDestructive: false }
}

function classifyGitCommand(args: string[]): CommandClassification {
  if (args.length === 0) {
    return { category: 'git', risk: 'safe', isReadOnly: true, isDestructive: false }
  }

  const joined = args.join(' ').toLowerCase()

  for (const destructive of GIT_DESTRUCTIVE_COMMANDS) {
    if (joined.startsWith(destructive)) {
      return { category: 'git ' + destructive, risk: 'dangerous', isReadOnly: false, isDestructive: true }
    }
  }

  for (const readOnly of GIT_READ_ONLY_COMMANDS) {
    if (joined.startsWith(readOnly)) {
      return { category: 'git ' + readOnly, risk: 'safe', isReadOnly: true, isDestructive: false }
    }
  }

  return { category: 'git', risk: 'moderate', isReadOnly: false, isDestructive: false }
}

function classifyRm(args: string[]): CommandClassification {
  if (args.some(a => a.startsWith('-') && DESTRUCTIVE_RM_FLAGS.has(a.toLowerCase().trim()))) {
    const hasGlob = args.some(a => a === '/' || a.includes('*') || a.includes('~'))
    return {
      category: 'rm',
      risk: hasGlob ? 'dangerous' : 'dangerous',
      isReadOnly: false,
      isDestructive: true,
    }
  }

  if (args.some(a => a.startsWith('-') && MODERATE_FLAGS_RM.has(a.toLowerCase().trim()))) {
    return { category: 'rm', risk: 'dangerous', isReadOnly: false, isDestructive: true }
  }

  return { category: 'rm', risk: 'moderate', isReadOnly: false, isDestructive: args.length > 0 }
}

// ============================================================================
// Injection Detection
// ============================================================================

export interface InjectionResult {
  hasInjection: boolean
  warnings: string[]
}

export function detectInjections(command: string): InjectionResult {
  const warnings: string[] = []
  const trimmed = command.trim()

  if (!trimmed) {
    return { hasInjection: false, warnings: [] }
  }

  const parsed = parseShellCommand(trimmed)
  const args = parsed.args

  if (args.length <= 1) {
    const hasSubshell = /\$\(/.test(trimmed) || /`[^`]+`/.test(trimmed)
    if (hasSubshell) {
      return { hasInjection: true, warnings: ['Command substitution detected in command'] }
    }
    return { hasInjection: false, warnings: [] }
  }

  const cmdArgs = args.slice(1)

  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i]
    const argIndex = i + 1

    const dollarParenMatch = arg.match(/\$\(([^)]+)\)/)
    if (dollarParenMatch && !isLikelySafeSubstitution(dollarParenMatch[1])) {
      warnings.push(`Argument ${argIndex} contains command substitution $(${dollarParenMatch[1]})`)
    }

    const backtickMatch = arg.match(/`([^`]+)`/)
    if (backtickMatch && !isLikelySafeSubstitution(backtickMatch[1])) {
      warnings.push(`Argument ${argIndex} contains backtick command substitution`)
    }

    if (/[;&|]/.test(arg) && !isQuoted(arg, trimmed) && arg.length > 1) {
      if (arg.includes(';') || arg.includes('&&') || arg.includes('||')) {
        warnings.push(`Argument ${argIndex} contains shell control operators`)
      }
    }

    if (arg.includes('../') || arg === '..' || /\.\.\\/.test(arg)) {
      warnings.push(`Argument ${argIndex} contains path traversal (../)`)
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) && arg.includes('PATH=')) {
      warnings.push(`Argument ${argIndex} manipulates PATH environment variable`)
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) && arg.includes('LD_PRELOAD=')) {
      warnings.push(`Argument ${argIndex} manipulates LD_PRELOAD`)
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) && arg.includes('IFS=')) {
      warnings.push(`Argument ${argIndex} manipulates IFS`)
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) && arg.includes('HOME=')) {
      warnings.push(`Argument ${argIndex} manipulates HOME`)
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) && arg.includes('SHELL=')) {
      warnings.push(`Argument ${argIndex} manipulates SHELL`)
    }

    if (/^https?:\/\//.test(arg) || /^ftps?:\/\//.test(arg)) {
      if (arg.includes('|') || arg.includes('`') || arg.includes('$')) {
        warnings.push(`Argument ${argIndex} contains URL with suspicious characters`)
      }
    }

    if (arg === '-o' || arg === '--option' || arg === '--config' || arg === '--rcfile') {
      const nextIdx = i + 1
      if (nextIdx < cmdArgs.length) {
        warnings.push(`Argument ${argIndex} is a config/option flag`)
      }
    }
  }

  const pipePatternMatch = SUSPICIOUS_PIPE_PATTERNS.find(p => p.test(trimmed))
  if (pipePatternMatch) {
    warnings.push('Suspicious piping pattern detected')
  }

  return {
    hasInjection: warnings.length > 0,
    warnings,
  }
}

function isLikelySafeSubstitution(content: string): boolean {
  const trimmed = content.trim()
  const safePatterns = [
    /^echo\s+/,
    /^\$\w+$/,
    /^\d+$/,
    /^(true|false)$/,
    /^pwd$/,
    /^(which|type|command)\s+/,
    /^(ls|cat|head|tail)\s+/,
    /^(date|whoami|hostname|id)$/,
    /^(printf|printenv|env)\s*/,
    /^\$\{[^}]+\}$/,
  ]

  return safePatterns.some(p => p.test(trimmed))
}

function isQuoted(arg: string, fullCommand: string): boolean {
  const idx = fullCommand.indexOf(arg)
  if (idx === -1) return false

  let quoteCount = 0
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (let i = 0; i < idx; i++) {
    const ch = fullCommand[i]
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === '\'' && !inDouble) { inSingle = !inSingle; quoteCount++; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; quoteCount++; continue }
  }

  const inQuotes = inSingle || inDouble
  return inQuotes
}

// ============================================================================
// Prompt Lists
// ============================================================================

export function getReadOnlyCommandsList(): string {
  return READONLY_COMMANDS_LIST
}

export function getDangerousCommandsList(): string {
  return DANGEROUS_COMMANDS_LIST
}

// ============================================================================
// Singleton
// ============================================================================

export const bashParser = {
  parse: parseShellCommand,
  classify: classifyCommand,
  detectInjections,
  getReadOnlyCommandsList,
  getDangerousCommandsList,
}
