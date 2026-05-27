import { z } from 'zod'
import type { Tool, PermissionResult, ToolContext } from './Tool'

const TOOL_DEFAULTS = {
  aliases: [] as string[],
  searchHint: undefined as string | undefined,
  outputSchema: undefined as z.ZodType<any> | undefined,
  checkPermissions: async (
    _input: any,
    _context: ToolContext,
  ): Promise<PermissionResult> => ({
    behavior: 'allow' as const,
    updatedInput: _input,
  }),
  isConcurrencySafe: (_input: any) => false,
  isEnabled: () => true,
  isReadOnly: (_input: any) => false,
  isDestructive: undefined as ((input: any) => boolean) | undefined,
  requiresUserInteraction: undefined as (() => boolean) | undefined,
  prompt: async (_options: any) => '',
  toAutoClassifierInput: (input: any) => input,
  mapToolResultToToolResultBlockParam: (
    content: string,
    toolUseID: string,
  ) => ({
    type: 'tool_result' as const,
    content,
    tool_use_id: toolUseID,
    is_error: false,
  }),
  maxResultSizeChars: 10_000,
  alwaysLoad: false,
  shouldDefer: false,
  mcpInfo: undefined as { serverName: string; toolName: string } | undefined,
}

export function buildTool<Input, Output>(
  def: Omit<Tool<Input, Output>, keyof typeof TOOL_DEFAULTS> &
    Partial<Pick<Tool<Input, Output>, keyof typeof TOOL_DEFAULTS>>,
): Tool<Input, Output> {
  return {
    ...TOOL_DEFAULTS,
    ...def,
  } as Tool<Input, Output>
}
