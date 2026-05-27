import { Tool, ToolContext, ToolResult } from './Tool'
import { getMcpService, type McpToolDef } from './MCPClient'

export function mcpToolDefToTool(def: McpToolDef): Tool {
  const tool: Tool = {
    name: def.name,
    aliases: [`mcp_${def.serverName}_${def.name}`],
    description: def.description || `MCP tool from server "${def.serverName}"`,
    inputSchema: { _def: { typeName: 'ZodObject', shape: {} } } as any,
    outputSchema: undefined,
    mcpInfo: { serverName: def.serverName, toolName: def.name },

    call: async (args: any, _context: ToolContext): Promise<ToolResult> => {
      const service = getMcpService()
      const result = await service.callTool(def.serverName, def.name, args || {})
      const text = result.content
        .map(c => c.text || c.data || '')
        .filter(Boolean)
        .join('\n')
      return { content: text, isError: result.isError }
    },

    checkPermissions: async () => ({ behavior: 'allow' as const }),
    isConcurrencySafe: () => true,
    isEnabled: () => true,
    isReadOnly: () => true,
    isDestructive: () => false,
    requiresUserInteraction: () => false,
    prompt: async () => `${def.name}: ${def.description || 'MCP tool'}`,
    toAutoClassifierInput: (input: any) => JSON.stringify(input),
    mapToolResultToToolResultBlockParam: (content: string, toolUseID: string) => ({
      type: 'tool_result',
      content,
      tool_use_id: toolUseID,
      is_error: false,
    }),
    maxResultSizeChars: 100_000,
    alwaysLoad: false,
    shouldDefer: false,
  }

  return tool
}

export function getAllMcpTools(): Tool[] {
  try {
    const service = getMcpService()
    const defs = service.getTools()
    return defs.map(mcpToolDefToTool)
  } catch {
    return []
  }
}
