// ============================================================================
// File Edit Protocol (based on Claude Code's FileEditTool)
// Two-phase validate-then-execute with fuzzy matching, staleness detection
// ============================================================================

import { z } from 'zod'
import { buildTool } from './ToolBuilder'

// Quote constants for normalization
const LEFT_SINGLE_CURLY = '\u2018'
const RIGHT_SINGLE_CURLY = '\u2019'
const LEFT_DOUBLE_CURLY = '\u201C'
const RIGHT_DOUBLE_CURLY = '\u201D'

export function normalizeQuotes(str: string): string {
  return str
    .split(LEFT_SINGLE_CURLY).join("'")
    .split(RIGHT_SINGLE_CURLY).join("'")
    .split(LEFT_DOUBLE_CURLY).join('"')
    .split(RIGHT_DOUBLE_CURLY).join('"')
}

export function findActualString(fileContent: string, searchString: string): string | null {
  if (fileContent.includes(searchString)) return searchString

  const normalizedSearch = normalizeQuotes(searchString)
  const normalizedFile = normalizeQuotes(fileContent)
  const searchIndex = normalizedFile.indexOf(normalizedSearch)
  if (searchIndex !== -1) {
    return fileContent.substring(searchIndex, searchIndex + searchString.length)
  }
  return null
}

export function preserveQuoteStyle(oldString: string, actualOldString: string, newString: string): string {
  if (oldString === actualOldString) return newString

  const hasDouble = actualOldString.includes(LEFT_DOUBLE_CURLY) || actualOldString.includes(RIGHT_DOUBLE_CURLY)
  const hasSingle = actualOldString.includes(LEFT_SINGLE_CURLY) || actualOldString.includes(RIGHT_SINGLE_CURLY)
  if (!hasDouble && !hasSingle) return newString

  const isOpen = (s: string, i: number): boolean => {
    if (i === 0) return true
    const prev = s[i - 1]
    return /\s/.test(prev) || '({[<"\''.includes(prev)
  }

  let result = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < newString.length; i++) {
    const ch = newString[i]
    if (ch === "'" && hasSingle) {
      if (isOpen(result, i) && !inDouble) {
        result += inSingle ? RIGHT_SINGLE_CURLY : LEFT_SINGLE_CURLY
        inSingle = !inSingle
      } else {
        result += ch
      }
    } else if (ch === '"' && hasDouble) {
      if (isOpen(result, i) && !inSingle) {
        result += inDouble ? RIGHT_DOUBLE_CURLY : LEFT_DOUBLE_CURLY
        inDouble = !inDouble
      } else {
        result += ch
      }
    } else {
      result += ch
    }
  }
  return result
}

export function getPatchForEdit(fileContent: string, oldString: string, newString: string): string {
  const before = fileContent.split(oldString)
  if (before.length <= 1) return ''

  const lines = fileContent.split('\n')
  const searchLines = oldString.split('\n')
  const replacementLines = newString.split('\n')

  const startLine = findLineNumber(lines, searchLines)
  if (startLine === -1) return formatPatch(oldString, newString)

  return formatUnifiedDiff(
    oldString, newString,
    startLine, searchLines.length,
    startLine, replacementLines.length,
  )
}

function findLineNumber(lines: string[], searchLines: string[]): number {
  for (let i = 0; i <= lines.length - searchLines.length; i++) {
    let match = true
    for (let j = 0; j < searchLines.length; j++) {
      if (lines[i + j] !== searchLines[j]) { match = false; break }
    }
    if (match) return i + 1
  }
  return -1
}

function formatPatch(oldString: string, newString: string): string {
  return [
    '--- a/file',
    '+++ b/file',
    '@@ -1 +1 @@',
    `-${oldString.split('\n')[0]}`,
    `+${newString.split('\n')[0]}`,
  ].join('\n')
}

function formatUnifiedDiff(
  _oldStr: string, _newStr: string,
  oldStart: number, oldLines: number,
  newStart: number, newLines: number,
): string {
  const oldRange = oldLines === 1 ? `${oldStart}` : `${oldStart},${oldLines}`
  const newRange = newLines === 1 ? `${newStart}` : `${newStart},${newLines}`

  return [
    '@@ -' + oldRange + ' +' + newRange + ' @@',
    ..._oldStr.split('\n').map(l => '-' + l),
    ..._newStr.split('\n').map(l => '+' + l),
  ].join('\n')
}

export type EditErrorCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface FileEditInput {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

export interface FileEditOutput {
  filePath: string
  oldString: string
  newString: string
  originalFile: string
  patch: string
  replaceAll: boolean
}

// Staleness tracker: tracks file read timestamps for staleness detection
const fileReadTimestamps = new Map<string, { timestamp: number; content: string }>()

export function recordFileRead(filePath: string, content: string): void {
  fileReadTimestamps.set(filePath, { timestamp: Date.now(), content })
}

export function clearFileReadTimestamp(filePath: string): void {
  fileReadTimestamps.delete(filePath)
}

async function getFileMtime(filePath: string): Promise<number> {
  try {
    const result = await window.api.executeCommand(
      `(Get-Item "${filePath.replace(/"/g, '`"')}").LastWriteTime.ToString("O")`,
      { timeout: 3000 },
    )
    if (result.exitCode === 0) return new Date(result.stdout.trim()).getTime()
  } catch { /* fall through */ }
  return Date.now()
}

async function readFileContent(filePath: string): Promise<string> {
  const text = await window.api.readFile(filePath)
  return text.replace(/\r\n/g, '\n')
}

export function getEditToolDescription(): string {
  return [
    '## Editing files',
    'The `Edit` tool is a **targeted file editing tool** that enables you to efficiently make targeted changes to files.',
    '',
    'When making edits:',
    '1. Provide the `file_path` (absolute path to the file)',
    '2. Provide the `old_string` (exact text to find)',
    '3. Provide the `new_string` (replacement text)',
    '4. Optionally set `replace_all` to true to replace all occurrences',
    '',
    'The tool uses fuzzy matching to handle curly/straight quote differences.',
    'Edits are validated before execution — if the old_string is not found, the tool will report the error before making any changes.',
  ].join('\n')
}

// ============================================================================
// Validation error messages
// ============================================================================

const ERROR_MESSAGES: Record<EditErrorCode, string> = {
  0: 'Edit introduces potential secrets into team memory files.',
  1: 'No changes to make: old_string and new_string are exactly the same.',
  2: 'File is in a directory denied by permission settings.',
  3: 'Cannot create file - file already exists with content.',
  4: 'File does not exist.',
  5: 'File is a Jupyter Notebook and cannot be edited with this tool.',
  6: 'File has not been read yet. Read it first before editing.',
  7: 'File has been modified since read. Read it again before editing.',
  8: 'String to replace not found in file.',
  9: 'Multiple matches found but replace_all is false.',
  10: 'File is too large to edit.',
}

export interface ValidationResult {
  result: boolean
  errorCode?: EditErrorCode
  message?: string
  actualOldString?: string
}

// ============================================================================
// Two-phase validation
// ============================================================================

export async function validateEdit(input: FileEditInput): Promise<ValidationResult> {
  const { file_path, old_string, new_string, replace_all = false } = input

  if (old_string === new_string) {
    return { result: false, errorCode: 1, message: ERROR_MESSAGES[1] }
  }

  let fileContent: string | null
  try {
    fileContent = await readFileContent(file_path)
  } catch (e) {
    fileContent = null
  }

  if (fileContent === null) {
    if (old_string === '') {
      return { result: true }
    }
    return {
      result: false,
      errorCode: 4,
      message: `File does not exist: ${file_path}`,
    }
  }

  if (old_string === '') {
    if (fileContent.trim() !== '') {
      return { result: false, errorCode: 3, message: ERROR_MESSAGES[3] }
    }
    return { result: true }
  }

  // Staleness detection
  const readState = fileReadTimestamps.get(file_path)
  if (!readState) {
    return {
      result: false,
      errorCode: 6,
      message: `File has not been read yet. Use Read tool first: ${file_path}`,
    }
  }

  const mtime = await getFileMtime(file_path)
  if (mtime > readState.timestamp && fileContent !== readState.content) {
    return {
      result: false,
      errorCode: 7,
      message: `File has been modified since read. Read it again: ${file_path}`,
    }
  }

  const actualOldString = findActualString(fileContent, old_string)
  if (!actualOldString) {
    return {
      result: false, errorCode: 8,
      message: `String to replace not found in file.\nString: ${old_string}`,
    }
  }

  const matches = fileContent.split(actualOldString).length - 1
  if (matches > 1 && !replace_all) {
    return {
      result: false, errorCode: 9,
      message: `Found ${matches} matches. Set replace_all to true or provide more context.`,
      actualOldString,
    }
  }

  return { result: true, actualOldString }
}

// ============================================================================
// FileEditTool
// ============================================================================

export const FileEditTool = buildTool({
  name: 'Edit',
  description: 'Targeted file editing tool with fuzzy matching and staleness detection',
  searchHint: 'modify file contents in place',
  inputSchema: z.object({
    file_path: z.string().describe('The absolute path to the file to modify'),
    old_string: z.string().describe('The exact text to replace'),
    new_string: z.string().describe('The replacement text (must differ from old_string)'),
    replace_all: z.boolean().default(false).optional().describe('Replace all occurrences (default false)'),
  }),
  isReadOnly: () => false,
  isConcurrencySafe: () => false,
  isDestructive: () => true,
  async call(args, _context): Promise<{ content: string; isError: boolean }> {
    const { file_path, old_string, new_string, replace_all = false } = args as FileEditInput

    // Phase 1: Validate
    const validation = await validateEdit(args as FileEditInput)
    if (!validation.result) {
      return {
        content: `[Edit Error: ${validation.message}]`,
        isError: true,
      }
    }

    // Read file content
    let fileContent: string
    try {
      fileContent = await readFileContent(file_path)
    } catch {
      return { content: `Error reading file: ${file_path}`, isError: true }
    }

    // Phase 2: Execute
    const actualOldString = findActualString(fileContent, old_string)!
    const styledNewString = preserveQuoteStyle(old_string, actualOldString, new_string)
    const newFileContent = replace_all
      ? fileContent.split(actualOldString).join(styledNewString)
      : fileContent.replace(actualOldString, styledNewString)

    try {
      await window.api.writeFile(file_path, newFileContent)
    } catch (error) {
      return {
        content: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      }
    }

    // Update read state
    fileReadTimestamps.set(file_path, { timestamp: Date.now(), content: newFileContent })

    const patch = replace_all
      ? `Replaced all occurrences of the string`
      : getPatchForEdit(fileContent, actualOldString, styledNewString)

    return {
      content: `Successfully edited ${file_path}\n\nPatch:\n${patch}`,
      isError: false,
    }
  },
  toAutoClassifierInput: (input: any) => `${input.file_path}: ${input.old_string} -> ${input.new_string}`,
  async prompt() {
    return getEditToolDescription()
  },
})
