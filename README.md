# OpenDesktop

An open-source AI desktop application that provides a Claude Desktop-like experience with support for multiple AI providers including NVIDIA NIM, Ollama, LM Studio, and any OpenAI-compatible API.

## Features

### Phase 1 (MVP) - ✅ Complete
- **Multi-provider support**: Configure and switch between AI providers
- **Streaming responses**: Real-time token streaming from AI models
- **Persistent storage**: Settings and chat history saved locally
- **Clean UI**: Modern, responsive chat interface with TailwindCSS

### Coming Soon
- **MCP Integration**: File system, terminal, and git operations
- **Skill System**: Extensible commands and agent capabilities
- **Browser Automation**: Playwright-powered web interaction
- **Computer Use Agent**: Desktop automation with vision models
- **Agent Creation**: Build custom agents with specific capabilities

## Getting Started

### Prerequisites
- Node.js 18+ installed
- API key for your chosen AI provider (or local model setup)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run in development mode**
   ```bash
   npm run electron:dev
   ```

3. **Build for production**
   ```bash
   npm run electron:build
   ```

## Configuration

### Adding a Provider

Open the settings (gear icon) in the app and add a provider:

#### NVIDIA NIM
- **Base URL**: `https://integrate.api.nvidia.com`
- **Model**: `meta/llama-3.1-8b-instruct` (or any NVIDIA model)
- **API Key**: Your NVIDIA API key

#### Ollama (Local)
- **Base URL**: `http://localhost:11434`
- **Model**: `llama3.2` (or any installed model)
- **API Key**: Not required

#### LM Studio
- **Base URL**: `http://localhost:1234/v1`
- **Model**: `local-model`
- **API Key**: Not required

#### Custom OpenAI-Compatible API
- **Base URL**: Your API endpoint
- **Model**: Your model name
- **API Key**: Your API key

## Project Structure

```
opendesktop/
├── electron/           # Electron main process
│   ├── main.ts        # Main process entry
│   └── preload.ts     # Preload script for IPC
├── src/
│   └── renderer/      # React application
│       ├── components/
│       │   ├── ChatInterface.tsx
│       │   ├── MessageList.tsx
│       │   └── SettingsModal.tsx
│       ├── services/
│       │   └── ApiClient.ts
│       ├── store/
│       │   └── chatStore.ts
│       ├── types/
│       │   └── index.ts
│       └── App.tsx
├── package.json
└── vite.config.ts
```

## Architecture

### API Client
The `ApiClient` class provides OpenAI-compatible API support:
- Works with NVIDIA NIM, Ollama, LM Studio, and more
- Streaming response support
- Connection testing

### State Management
Zustand is used for state management with persistence:
- Chat messages
- Provider configurations
- UI state

### Security
- API keys stored locally (electron-store with encryption coming)
- No cloud dependency for core functionality
- Context isolation in Electron

## Roadmap

### Phase 2: MCP + Skills
- [ ] MCP client integration
- [ ] File system operations
- [ ] Terminal commands
- [ ] Skill system architecture
- [ ] Default skills implementation

### Phase 3: Browser Automation
- [ ] Playwright integration
- [ ] Browser control tools
- [ ] Content extraction
- [ ] Web scraping skills

### Phase 4: Computer Use Agent
- [ ] Screen capture
- [ ] Mouse/keyboard control
- [ ] Vision model integration
- [ ] Autonomous workflows

### Phase 5: Agent System
- [ ] Agent creation UI
- [ ] Agent orchestration
- [ ] Workflow definitions
- [ ] Cowork mode

## Development

### Commands
- `npm run dev` - Start Vite dev server
- `npm run build` - Build React app
- `npm run electron:dev` - Run Electron with hot reload
- `npm run electron:build` - Build production package

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.
