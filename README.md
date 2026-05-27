# OpenDesktop

An open-source AI agent desktop application — a Claude Code alternative that runs on Windows, macOS, and Linux. Supports multiple AI providers, MCP tools, sub-agents, skills, and computer use.

## Features

### Core
- Multi-provider: Anthropic (direct API), OpenAI-compatible (NVIDIA NIM, Ollama, LM Studio, OpenRouter, custom), Bedrock-ready
- Streaming responses with real-time token delivery
- Persistent chat history and settings (local storage)

### Agent System
- Sub-agent forking (explore, general, custom agents)
- Agent orchestration with turn limits and permission control
- Autonomous multi-step task execution

### Tools (12 built-in)
- Read, Write, FileEdit, Bash, Glob, Grep
- TodoWrite, AskUserQuestion
- Task (sub-agent spawning), Skill (skill invocation)
- WebFetch, WebSearch (Firecrawl-powered)

### MCP Integration
- Full Model Context Protocol client (stdio, SSE, HTTP transports)
- Tool discovery and execution from MCP servers
- Resource and prompt support

### Context Management
- 5-layer context compaction pipeline (identical to Claude Code's approach)
- Token budgeting, history snipping, microcompaction
- Auto-compact with circuit breaker

### Skills System
- SKILL.md format with YAML frontmatter
- Two-phase discovery (listing + content loading)
- Supports .claude/skills and .opendesktop/skills directories
- Agent and tool configuration via frontmatter

### Computer Use
- Screenshot capture, mouse control, keyboard input (via nut-js)
- Clipboard read/write
- Cross-platform desktop automation

### UI
- React + TailwindCSS with dark theme
- Multi-panel layout (chat, tools, terminal, skills, settings)
- File explorer, diff viewer, code highlighting
- Session tabs, thinking panel, live tool calls

## Getting Started

### Prerequisites
- Node.js 18+
- API key for your chosen provider (or local model)

### Quick Start
```bash
npm install
npm run electron:dev
```

### Build
```bash
npm run electron:build
```

## Provider Setup

### Anthropic (Claude)
Set providerType to "anthropic" and use your API key:
- Base URL: `https://api.anthropic.com`
- Model: `claude-sonnet-4-20250514`
- API Key: Your Anthropic API key (sk-ant-...)

### OpenAI-compatible
Works with any OpenAI-compatible endpoint:
- NVIDIA NIM: `https://integrate.api.nvidia.com`
- Ollama: `http://localhost:11434`
- LM Studio: `http://localhost:1234/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

### Web Search
Set `FIRECRAWL_API_KEY` in environment or `.env` for web search capability.

## Project Structure
```
opendesktop/
├── electron/           # Electron main process + IPC handlers
│   ├── main.ts        # Main process: API routing, terminal, file ops
│   ├── preload.ts     # Context bridge for renderer
│   ├── skills/        # System + browser skill implementations
│   └── mcp/           # MCP client transport layer
├── src/
│   ├── core/io/       # Platform-agnostic I/O abstraction
│   ├── cli/           # Headless CLI mode
│   └── renderer/      # React application
│       ├── components/ # 30+ UI components
│       ├── services/   # 40+ service modules
│       ├── store/      # Zustand state management
│       └── types/      # TypeScript type definitions
└── tests/             # Vitest + Playwright tests
```

## Tech Stack
- Electron 33 + React 19 + TypeScript 5.6
- Vite 6 + TailwindCSS 3 + Zustand 5
- MCP SDK, nut-js (computer use), Playwright (testing)

## License
MIT
