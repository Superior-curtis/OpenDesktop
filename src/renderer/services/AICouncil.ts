export interface AgentProfile {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  tools: string[]
  isActive: boolean
}

export interface CouncilMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: number
  isProposal: boolean
  votes?: Record<string, 'approve' | 'reject'>
}

export interface CouncilSession {
  id: string
  topic: string
  agents: AgentProfile[]
  messages: CouncilMessage[]
  status: 'initializing' | 'discussing' | 'voting' | 'concluded'
  conclusion: string | null
  startedAt: number
  concludedAt: number | null
}

export interface CouncilConfig {
  maxRounds: number
  votingThreshold: number
  enableConsensus: boolean
  enableDebate: boolean
}

const DEFAULT_AGENTS: AgentProfile[] = [
  {
    id: 'architect',
    name: 'Architect',
    role: 'System Design & Architecture',
    description: 'Focuses on overall system design, architecture decisions, and long-term maintainability',
    systemPrompt: `You are the Architect agent in an AI Council. Your role is to:
- Analyze system design requirements
- Propose architectural patterns and structures
- Consider scalability, maintainability, and extensibility
- Evaluate trade-offs between different approaches
- Ensure design consistency across the project
Focus on high-level design decisions rather than implementation details.`,
    tools: ['Read', 'Glob', 'Write'],
    isActive: true,
  },
  {
    id: 'engineer',
    name: 'Engineer',
    role: 'Implementation & Code Quality',
    description: 'Focuses on writing clean, efficient, and maintainable code',
    systemPrompt: `You are the Engineer agent in an AI Council. Your role is to:
- Write clean, efficient, and well-documented code
- Follow best practices and coding standards
- Consider edge cases and error handling
- Optimize performance where necessary
- Ensure code is testable and maintainable
Focus on implementation details and code quality.`,
    tools: ['Read', 'Write', 'Edit', 'Bash'],
    isActive: true,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Code Review & Quality Assurance',
    description: 'Reviews code for bugs, security issues, and quality standards',
    systemPrompt: `You are the Reviewer agent in an AI Council. Your role is to:
- Review code for bugs, security vulnerabilities, and anti-patterns
- Check for adherence to coding standards and best practices
- Identify potential performance bottlenecks
- Suggest improvements and optimizations
- Ensure proper error handling and edge case coverage
Be thorough but constructive in your feedback.`,
    tools: ['Read', 'Glob', 'Bash'],
    isActive: true,
  },
  {
    id: 'researcher',
    name: 'Researcher',
    role: 'Research & Knowledge Gathering',
    description: 'Researches best practices, libraries, and solutions',
    systemPrompt: `You are the Researcher agent in an AI Council. Your role is to:
- Research best practices and industry standards
- Find relevant libraries, frameworks, and tools
- Gather information about APIs and integrations
- Provide context and background knowledge
- Identify potential risks and limitations
Focus on gathering accurate and relevant information.`,
    tools: ['WebFetch', 'WebSearch'],
    isActive: true,
  },
  {
    id: 'planner',
    name: 'Planner',
    role: 'Task Planning & Coordination',
    description: 'Breaks down complex tasks into manageable steps',
    systemPrompt: `You are the Planner agent in an AI Council. Your role is to:
- Break down complex tasks into smaller, manageable steps
- Prioritize tasks based on dependencies and importance
- Create realistic timelines and milestones
- Coordinate work between different agents
- Track progress and adjust plans as needed
Focus on organization, prioritization, and coordination.`,
    tools: ['TodoWrite', 'Read', 'Write'],
    isActive: true,
  },
]

const DEFAULT_CONFIG: CouncilConfig = {
  maxRounds: 5,
  votingThreshold: 0.6,
  enableConsensus: true,
  enableDebate: true,
}

export type CouncilModelCaller = (
  messages: { role: string; content: string }[],
  systemPrompt: string,
) => AsyncGenerator<string>

export class AICouncil {
  private config: CouncilConfig
  private sessions: Map<string, CouncilSession> = new Map()
  private agents: AgentProfile[]
  private onSessionUpdate?: (session: CouncilSession) => void

  constructor(config: Partial<CouncilConfig> = {}, agents?: AgentProfile[]) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.agents = agents || DEFAULT_AGENTS
  }

  setCallbacks(callbacks: {
    onSessionUpdate?: (session: CouncilSession) => void
  }) {
    this.onSessionUpdate = callbacks.onSessionUpdate
  }

  createSession(topic: string, agentIds?: string[]): CouncilSession {
    const selectedAgents = agentIds
      ? this.agents.filter((a) => agentIds.includes(a.id))
      : this.agents.filter((a) => a.isActive)

    const session: CouncilSession = {
      id: `council-${Date.now()}`,
      topic,
      agents: selectedAgents,
      messages: [],
      status: 'initializing',
      conclusion: null,
      startedAt: Date.now(),
      concludedAt: null,
    }

    this.sessions.set(session.id, session)
    this.notifyUpdate(session)
    return session
  }

  async startDiscussion(
    sessionId: string,
    callModel: CouncilModelCaller,
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.status = 'discussing'
    this.notifyUpdate(session)

    const deliberationContext = `Council Topic: ${session.topic}\n\n` +
      `Participating Agents:\n${session.agents.map(a => `- ${a.name} (${a.role})`).join('\n')}\n\n` +
      `Please provide your analysis and recommendations from your perspective.`

    for (let round = 0; round < this.config.maxRounds; round++) {
      if (session.status !== 'discussing') break

      for (const agent of session.agents) {
        const previousMessages = session.messages
          .map(m => `${m.agentName}: ${m.content}`)
          .join('\n\n')

        const context = round === 0
          ? deliberationContext
          : `${deliberationContext}\n\nPrevious discussion:\n${previousMessages}\n\nContinue your analysis. ${agent.name}, respond from your ${agent.role} perspective.`

        let content = ''
        try {
          for await (const chunk of callModel(
            session.messages.map(m => ({ role: 'assistant', content: `${m.agentName}: ${m.content}` })),
            `${agent.systemPrompt}\n\n${context}`,
          )) {
            content += chunk
          }
        } catch {
          content = `[${agent.name} could not generate response]`
        }

        const message: CouncilMessage = {
          id: `msg-${Date.now()}-${agent.id}-${round}`,
          agentId: agent.id,
          agentName: agent.name,
          content: content || `[${agent.name} analysis from ${agent.role} perspective]`,
          timestamp: Date.now(),
          isProposal: round === this.config.maxRounds - 1,
        }

        session.messages.push(message)
        this.notifyUpdate(session)
      }
    }

    if (this.config.enableConsensus) {
      session.status = 'voting'
      this.notifyUpdate(session)
    }

    session.status = 'concluded'
    session.concludedAt = Date.now()
    session.conclusion = this.generateConclusion(session)
    this.notifyUpdate(session)
  }

  private generateConclusion(session: CouncilSession): string {
    const proposals = session.messages.filter((m) => m.isProposal)

    if (proposals.length > 0) {
      return `Council reached conclusion after ${session.messages.length} messages across ${session.agents.length} agents.\n\n` +
        proposals.map(p => `**${p.agentName}**: ${p.content}`).join('\n\n')
    }

    const summary = session.messages
      .map(m => `**${m.agentName}**: ${m.content.slice(0, 200)}...`)
      .join('\n\n')

    return `Council discussion completed.\n\n${summary}`
  }

  getSession(sessionId: string): CouncilSession | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): CouncilSession[] {
    return Array.from(this.sessions.values())
  }

  getActiveSessions(): CouncilSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status !== 'concluded')
  }

  addAgent(agent: AgentProfile): void {
    this.agents.push(agent)
  }

  removeAgent(agentId: string): void {
    this.agents = this.agents.filter((a) => a.id !== agentId)
  }

  updateConfig(config: Partial<CouncilConfig>): void {
    this.config = { ...this.config, ...config }
  }

  private notifyUpdate(session: CouncilSession): void {
    this.onSessionUpdate?.({ ...session, messages: [...session.messages] })
  }

  getAgents(): AgentProfile[] {
    return [...this.agents]
  }

  reset(): void {
    this.sessions.clear()
  }
}

export function createAICouncil(config?: Partial<CouncilConfig>, agents?: AgentProfile[]): AICouncil {
  return new AICouncil(config, agents)
}
