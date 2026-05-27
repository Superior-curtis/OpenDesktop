import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Send, Settings, MessageSquare, Code, FolderTree, Plus, Bot, FileText, Terminal, Sparkles, GitCompare, File, Eye } from 'lucide-react'

interface OnboardingProps {
  onComplete: () => void
}

const STEPS = [
  {
    title: 'Welcome to OpenDesktop',
    subtitle: 'Your AI-powered desktop assistant',
    icon: Sparkles,
    content: 'A powerful AI desktop application with multi-session support, project management, and intelligent tools. Let us show you around.',
  },
  {
    title: 'Chat Modes',
    subtitle: 'Choose your interaction style',
    icon: MessageSquare,
    content: 'Switch between three modes at the bottom: Chat for general questions, Cowork for collaborative tasks, and Code for programming help. Each mode adjusts the AI behavior.',
  },
  {
    title: 'Session Tabs',
    subtitle: 'Multiple conversations at once',
    icon: MessageSquare,
    content: 'Create multiple sessions with the + button in the tab bar. Drag tabs to reorder. Right-click to rename, pin, or close. Each session keeps its own conversation history.',
  },
  {
    title: 'Projects',
    subtitle: 'Organize your work',
    icon: FolderTree,
    content: 'Click the folder icon in the top-left to open the project sidebar. Create projects to group related sessions together and keep your work organized.',
  },
  {
    title: 'Code Mode Tools',
    subtitle: 'Available when in Code mode',
    icon: Code,
    content: 'Switch to Code mode to access: File Editor for editing code, Diff Viewer for tracking changes, and Terminal for running commands. These tools appear in the toolbar automatically.',
  },
  {
    title: 'Developer Mode',
    subtitle: 'Unlock advanced features',
    icon: Settings,
    content: 'Open Settings and enable Developer Mode to access: Skills, Tools panel, Thinking visualization, Sub-Agents management, HTML/PDF preview, and more.',
  },
  {
    title: 'Settings & Providers',
    subtitle: 'Connect your AI providers',
    icon: Settings,
    content: 'Click the gear icon to add API providers (OpenAI, Anthropic, Ollama, OpenCode Zen, etc.). Configure your model, theme, keyboard shortcuts, and preferences.',
  },
  {
    title: 'Ready to Go!',
    subtitle: 'Start chatting now',
    icon: Send,
    content: 'Type a message and press Enter. Use Shift+Enter for new lines. Click the microphone for voice input. You can always come back to this guide from Settings.',
  },
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = STEPS[currentStep]
  const Icon = step.icon

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden border border-zinc-800 animate-fade-in-scale" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-zinc-400">Step {currentStep + 1} of {STEPS.length}</span>
          </div>
          <button onClick={onComplete} className="p-1.5 hover:bg-zinc-800 rounded">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-0.5 bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{step.title}</h2>
              <p className="text-sm text-zinc-500">{step.subtitle}</p>
            </div>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed mb-6">{step.content}</p>

          {/* Visual Preview */}
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 mb-6">
            {currentStep === 0 && (
              <div className="flex items-center justify-center py-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-xs text-zinc-500">AI-powered desktop experience</p>
                </div>
              </div>
            )}
            {currentStep === 1 && (
              <div className="flex gap-1 justify-center">
                {[
                  { mode: 'Chat', icon: MessageSquare, active: true },
                  { mode: 'Cowork', icon: Bot, active: false },
                  { mode: 'Code', icon: Code, active: false },
                ].map(({ mode, icon: ModeIcon, active }) => (
                  <button
                    key={mode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs ${active ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-500'}`}
                  >
                    <ModeIcon className="w-3 h-3" />
                    {mode}
                  </button>
                ))}
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  {['Session 1', 'Code Review', 'Research'].map((name, i) => (
                    <div key={name} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${i === 0 ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}>
                      {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {name}
                    </div>
                  ))}
                  <Plus className="w-3 h-3 text-zinc-600 ml-1" />
                </div>
              </div>
            )}
            {currentStep === 3 && (
              <div className="space-y-1">
                {['My Project', 'API Integration', 'Documentation'].map((name, i) => (
                  <div key={name} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${i === 0 ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}>
                    <FolderTree className="w-3 h-3" />
                    {name}
                  </div>
                ))}
              </div>
            )}
            {currentStep === 4 && (
              <div className="flex gap-2 justify-center">
                {[
                  { icon: FileText, label: 'File Editor' },
                  { icon: GitCompare, label: 'Diff' },
                  { icon: Terminal, label: 'Terminal' },
                ].map(({ icon: TIcon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                      <TIcon className="w-5 h-5 text-zinc-400" />
                    </div>
                    <span className="text-[10px] text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {currentStep === 5 && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Bot, label: 'Sub-Agents' },
                  { icon: Eye, label: 'Preview' },
                  { icon: File, label: 'PDF' },
                ].map(({ icon: TIcon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 p-2 rounded bg-zinc-800/50">
                    <TIcon className="w-4 h-4 text-zinc-400" />
                    <span className="text-[10px] text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            )}
            {currentStep === 6 && (
              <div className="space-y-2">
                {['OpenAI', 'Anthropic', 'Ollama', 'OpenCode Zen'].map((name, i) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 text-xs text-zinc-400">
                    <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    {name}
                  </div>
                ))}
              </div>
            )}
            {currentStep === 7 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-8 rounded bg-zinc-800 border border-zinc-700 px-3 flex items-center text-xs text-zinc-500">
                  Type your message...
                </div>
                <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 text-zinc-900" />
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === currentStep ? 'bg-zinc-300' : i < currentStep ? 'bg-zinc-600' : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 rounded bg-zinc-100 text-zinc-900 text-xs font-medium hover:bg-white"
            >
              {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
