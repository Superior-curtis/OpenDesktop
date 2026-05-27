import { Message, Conversation } from './index'

export interface Session {
  id: string
  name: string
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  providerId: string | null
  mode: 'chat' | 'cowork' | 'code'
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  path: string
  description: string
  sessions: string[]
  createdAt: number
  updatedAt: number
}

export interface WorkspaceState {
  sessions: Session[]
  activeSessionId: string | null
  projects: Project[]
  activeProjectId: string | null
  layout: 'single' | 'split-h' | 'split-v' | 'grid'
  pinnedSessions: string[]
}

export interface DiffEntry {
  file: string
  oldContent: string
  newContent: string
  status: 'added' | 'modified' | 'deleted'
}

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  content?: string
}
