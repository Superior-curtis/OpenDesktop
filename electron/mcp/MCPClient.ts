import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Skill, SkillResult } from '../types'

export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export class MCPClient {
  private clients: Map<string, { client: Client; transport: StdioClientTransport }> = new Map()

  async connect(config: MCPServerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
      })

      const client = new Client(
        { name: 'opendesktop', version: '1.0.0' },
        { capabilities: {} }
      )

      await client.connect(transport)
      this.clients.set(config.id, { client, transport })

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Connection failed' }
    }
  }

  async disconnect(id: string): Promise<void> {
    const connection = this.clients.get(id)
    if (connection) {
      await connection.client.close()
      this.clients.delete(id)
    }
  }

  async listTools(serverId: string): Promise<Skill[]> {
    const connection = this.clients.get(serverId)
    if (!connection) return []

    const response = await connection.client.listTools()
    const tools = response.tools || []

    return tools.map((tool: any) => ({
      id: `${serverId}-${tool.name}`,
      name: tool.name,
      description: tool.description || 'No description',
      icon: 'Wrench',
      category: 'custom',
      params: Object.entries((tool.inputSchema as any)?.properties || {}).map(([name, prop]: [string, any]) => ({
        name,
        type: prop.type === 'number' ? 'number' : prop.type === 'boolean' ? 'boolean' : 'string',
        description: prop.description || '',
        required: (tool.inputSchema as any)?.required?.includes(name) || false,
      })),
      execute: async (params: Record<string, any>): Promise<SkillResult> => {
        try {
          const result = await connection.client.callTool({
            name: tool.name,
            arguments: params,
          })
          const content = (result as any).content || []
          return {
            success: true,
            output: content.map((c: any) => c.text || c.data).join('\n') || '',
          }
        } catch (error) {
          return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : 'Tool execution failed',
          }
        }
      },
    }))
  }

  async executeTool(serverId: string, toolName: string, params: Record<string, any>): Promise<SkillResult> {
    const connection = this.clients.get(serverId)
    if (!connection) {
      return { success: false, output: '', error: `Server "${serverId}" not connected` }
    }

    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: params,
      })
      const content = (result as any).content || []
      return {
        success: true,
        output: content.map((c: any) => c.text || c.data).join('\n') || '',
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }
    }
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys())
  }
}

export const mcpClient = new MCPClient()
