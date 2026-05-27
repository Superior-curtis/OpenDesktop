import { Tool, Tools } from './Tool'
import { getDynamicSkills } from './Skills'

export function buildToolUseSystemPrompt(tools: Tools): string {
  const parts: string[] = []
  try {
    for (const t of tools) {
      try {
        parts.push(buildToolDefinition(t))
      } catch { /* skip tool definition if it fails */ }
    }
  } catch { /* ignore */ }
  const skills = getDynamicSkills()
  if (skills.length > 0) {
    const skillNames = skills.map(s => `  • ${s.name}: ${s.description}`).join('\n')
    parts.push(`Skill\n  Description: Execute a skill by name. Use when a task matches a registered skill's purpose.\n  Parameters:\n    name (required): The skill name\n    args (optional): Arguments for the skill\n  Available skills:\n${skillNames}`)
  }

  return `## Tools Available
You have tools to read/write files, search code, and run commands.

### Response Format (MUST follow exactly)
Each response MUST include ALL of:
1. **Tool narration** — describe WHICH tool and WHY before calling it
2. **File paths with line numbers** — \`src/component.tsx:42\`
3. **Step numbering** for multi-step tasks

### Example Response
<thinking>I need to understand the component architecture first.
Step 1: Read the main service file to understand the data flow.
Step 2: Glob for related pattern files.
Step 3: Grep for usage patterns and analyze architecture using skills.</thinking>
I'll use \`Read\` to examine \`src/renderer/services/Tool.ts:42\` for the tool interface, then \`Grep\` for agent-related patterns to understand the sub-agent architecture.
<TOOL_CALLS><Read><path>src/renderer/services/Tool.ts</path></Read></TOOL_CALLS>

After reading, I'll analyze the code patterns using skills and potentially delegate subtasks to sub-agents for parallel exploration. My analysis will reference specific file paths with line numbers like \`src/services/AgentSystem.ts:55\` and summarize key architectural findings.

### Rules
- <thinking>reason step by step</thinking> before any tool call
- Describe your intended tool then call it: "I'll \`Read\` \`src/file.tsx:42\` to...", "Let me \`Glob\` for...", "I'll \`Grep\` for..."
- Use XML tool calls inside \`<TOOL_CALLS>\` tags
- Structure ALL multi-step tasks with "Step 1:", "Step 2:" numbering
- Cite EVERY file path with backticks AND line numbers: \`src/file.tsx:42\`
- When analyzing code, mention specific functions, patterns, skills, or architecture terms
- When discussing multi-step work, mention relevant tools, sub-agents, or approaches
- Use skills and the Explore agent for tasks that match their descriptions
- NEVER use generic templates — respond specifically to the user's actual request

### Available Tools
${parts.join('\n\n')}`
}

function buildToolDefinition(tool: Tool): string {
  const schema = tool.inputSchema
  const description = tool.description
  const params = extractZodParams(schema)
  const paramLines = params.map(p => `    ${p.required ? '(required)' : '(optional)'} ${p.name}: ${p.type} - ${p.description}`).join('\n')

  return `${tool.name}
  Description: ${description}
  ${tool.isReadOnly({}) ? '  Read-only: Yes (safe to use without asking)' : '  Read-only: No (may modify files, ask permission)'}
  Parameters:\n${paramLines || '    (no parameters)'}`
}

function extractZodParams(schema: any): Array<{ name: string; type: string; description: string; required: boolean }> {
  try {
    if (!schema || !schema._def) return []
    const shape = schema._def.innerType?._def?.shape?.() || schema._def.shape?.()
    if (!shape) return []
    return Object.entries(shape).map(([name, def]: [string, any]) => {
      let type = 'string'
      let description = ''

      if (def._def) {
        if (def._def.innerType) {
          if (def._def.innerType._def?.typeName === 'ZodArray') {
            type = 'array'
            const itemType = def._def.innerType._def?.type
            if (itemType) type = `${itemType}[]`
            description = def._def.innerType._def?.description || ''
          }
        } else {
          type = def._def.typeName?.replace('Zod', '').toLowerCase() || 'string'
          description = def._def.description || ''
          if (def._def.values) {
            const enumVals = Array.isArray(def._def.values) ? def._def.values : Object.values(def._def.values || {})
            type = `enum: ${enumVals.join(' | ')}`
          }
        }
      }
      const isRequired = !def._def?.isNullable?.()
      return { name, type, description, required: isRequired }
    })
  } catch {
    return []
  }
}

export function parseToolCallsFromContent(fullContent: string): Array<{ name: string; args: Record<string, any> }> {
  const results: Array<{ name: string; args: Record<string, any> }> = []

  // Format 1: XML format — <TOOL_CALLS><ToolName><param>value</param></ToolName></TOOL_CALLS>
  const toolCallRegex = /<TOOL_CALLS>([\s\S]*?)<\/TOOL_CALLS>/g
  let match: RegExpExecArray | null

  while ((match = toolCallRegex.exec(fullContent)) !== null) {
    const callsBlock = match[1]
    const callRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
    let callMatch: RegExpExecArray | null

    while ((callMatch = callRegex.exec(callsBlock)) !== null) {
      const toolName = callMatch[1]
      if (toolName === 'TOOL_CALLS') continue
      const innerXml = callMatch[2]
      const args: Record<string, any> = {}
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
      let paramMatch: RegExpExecArray | null
      while ((paramMatch = paramRegex.exec(innerXml)) !== null) {
        args[paramMatch[1]] = paramMatch[2].trim()
      }
      results.push({ name: toolName, args })
    }
  }

  // Format 1b: Handle truncated closing tags — model often generates </TOOL_CALL (missing S and >)
  const truncatedRegex = /<(?:TOOL_CALLS|TOOL_CALL|tool_calls|tool_call)>([\s\S]*?)(?:$|\[Stream|\[Error)/g
  let truncMatch: RegExpExecArray | null
  while ((truncMatch = truncatedRegex.exec(fullContent)) !== null) {
    const callsBlock = truncMatch[1]
    const callRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
    let callMatch: RegExpExecArray | null
    while ((callMatch = callRegex.exec(callsBlock)) !== null) {
      const toolName = callMatch[1]
      if (toolName === 'TOOL_CALLS') continue
      const innerXml = callMatch[2]
      const args: Record<string, any> = {}
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
      let paramMatch: RegExpExecArray | null
      while ((paramMatch = paramRegex.exec(innerXml)) !== null) {
        args[paramMatch[1]] = paramMatch[2].trim()
      }
      results.push({ name: toolName, args })
    }
  }

  // Format 2: Lowercase XML variant — <tool_call>, <TOOL_CALL>
  const toolCallLowerRegex = /<(?:TOOL_CALL|tool_calls|tool_call)>([\s\S]*?)<\/(?:TOOL_CALL|tool_calls|tool_call)>/gi
  let lowerMatch: RegExpExecArray | null
  while ((lowerMatch = toolCallLowerRegex.exec(fullContent)) !== null) {
    const callsBlock = lowerMatch[1]
    const callRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
    let callMatch: RegExpExecArray | null
    while ((callMatch = callRegex.exec(callsBlock)) !== null) {
      const toolName = callMatch[1]
      const innerXml = callMatch[2]
      const args: Record<string, any> = {}
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
      let paramMatch: RegExpExecArray | null
      while ((paramMatch = paramRegex.exec(innerXml)) !== null) {
        args[paramMatch[1]] = paramMatch[2].trim()
      }
      results.push({ name: toolName, args })
    }
  }

  // Format 3: JSON format — [TOOL_CALLS][{"name":"ToolName","arguments":{"key":"value"}}][/TOOL_CALLS]
  const jsonToolCallRegex = /\[TOOL_CALLS\]\s*(\[[\s\S]*?\])\s*\[\/TOOL_CALLS\]/g
  let jsonMatch: RegExpExecArray | null
  while ((jsonMatch = jsonToolCallRegex.exec(fullContent)) !== null) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (Array.isArray(parsed)) {
        for (const call of parsed) {
          if (call.name) {
            results.push({
              name: call.name,
              args: typeof call.arguments === 'object' && call.arguments !== null ? call.arguments : (call.input ?? {}),
            })
          }
        }
      }
    } catch {
      // JSON parse failed — skip
    }
  }

  // Format 4: Qwen-style <TOOL_INTERNAL> or <TOOL_IN> or <TOOL> blocks
  // Qwen models sometimes generate <TOOL_INTERNAL> or <TOOL> with JSON body
  const qwenToolRegex = /<(?:TOOL_INTERNAL|TOOL_IN|TOOL)>([\s\S]*?)<\/(?:TOOL_INTERNAL|TOOL_IN|TOOL)>/gi
  let qwenMatch: RegExpExecArray | null
  while ((qwenMatch = qwenToolRegex.exec(fullContent)) !== null) {
    const body = qwenMatch[1].trim()
    try {
      const parsed = JSON.parse(body)
      if (parsed.name || parsed.tool_name || parsed.function) {
        const name = parsed.name || parsed.tool_name || parsed.function
        const args = parsed.arguments || parsed.parameters || parsed.input || parsed.args || {}
        results.push({ name, args })
      }
    } catch {
      // Try XML-style parsing inside the TOOL block
      const innerRegex = /<(\w+)>([\s\S]*?)<\/\1>/g
      let innerMatch: RegExpExecArray | null
      const args: Record<string, any> = {}
      let toolName = ''
      while ((innerMatch = innerRegex.exec(body)) !== null) {
        if (innerMatch[1] === 'tool_name' || innerMatch[1] === 'name') {
          toolName = innerMatch[2].trim()
        } else {
          args[innerMatch[1]] = innerMatch[2].trim()
        }
      }
      if (toolName) {
        results.push({ name: toolName, args })
      }
    }
  }

  // Format 5: Truncated Qwen format — <TOOL_INTERNAL or <TOOL_IN or <TOOL without closing tag
  // Qwen sometimes generates the opening tag without closing
  const qwenTruncatedRegex = /<(?:TOOL_INTERNAL|TOOL_IN|TOOL)>([\s\S]*?)$/g
  let qwenTruncMatch: RegExpExecArray | null
  while ((qwenTruncMatch = qwenTruncatedRegex.exec(fullContent)) !== null) {
    const body = qwenTruncMatch[1].trim()
    if (!body) continue
    try {
      const parsed = JSON.parse(body)
      if (parsed.name || parsed.tool_name || parsed.function) {
        const name = parsed.name || parsed.tool_name || parsed.function
        const args = parsed.arguments || parsed.parameters || parsed.input || parsed.args || {}
        results.push({ name, args })
      }
    } catch {
      // Not valid JSON in truncated block — skip
    }
  }

  return results
}

export function mergeToolCallsIntoTemplate(
  template: string,
  toolCalls: Array<{ name: string; args: Record<string, any> }>,
): string {
  let result = template
  for (const tc of toolCalls) {
    const argsStr = Object.entries(tc.args)
      .map(([k, v]) => `      <${k}>${v}</${k}>`)
      .join('\n')
    const callBlock = `    <${tc.name}>\n${argsStr}\n    </${tc.name}>`
    result = result.replace('<TOOL_CALLS>', `<TOOL_CALLS>\n${callBlock}`)
  }
  result = result.replace('<TOOL_CALLS>', '<TOOL_CALLS>')
  return result
}
