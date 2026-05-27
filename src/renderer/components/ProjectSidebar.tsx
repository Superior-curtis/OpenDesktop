import { useState } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import { Folder, FolderPlus, FolderOpen, Trash2, X } from 'lucide-react'

interface ProjectSidebarProps {
  onClose: () => void
}

export function ProjectSidebar({ onClose }: ProjectSidebarProps) {
  const {
    projects,
    activeProjectId,
    addProject,
    removeProject,
    switchProject,
  } = useWorkspaceStore()

  const [showNewProject, setShowNewProject] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', path: '', description: '' })

  const handleAddProject = () => {
    if (!newProject.name.trim()) return
    addProject({
      name: newProject.name.trim(),
      path: newProject.path.trim() || '/',
      description: newProject.description.trim(),
      sessions: [],
    })
    setNewProject({ name: '', path: '', description: '' })
    setShowNewProject(false)
  }

  return (
    <div className="w-56 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Projects</span>
        <div className="flex gap-1">
          <button
            onClick={() => setShowNewProject(!showNewProject)}
            className="p-1 hover:bg-zinc-800 rounded"
            title="New Project"
          >
            <FolderPlus className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
            <X className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* New Project Form */}
      {showNewProject && (
        <div className="p-2 border-b border-zinc-800 space-y-1.5">
          <input
            type="text"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            placeholder="Project name"
            className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text"
            value={newProject.path}
            onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
            placeholder="Path (optional)"
            className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="text"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
          <div className="flex gap-1">
            <button
              onClick={handleAddProject}
              className="flex-1 py-1 rounded bg-zinc-100 text-zinc-900 text-xs hover:bg-white"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewProject(false)}
              className="flex-1 py-1 rounded bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs">
            No projects yet
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                project.id === activeProjectId
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'hover:bg-zinc-800/50 text-zinc-400'
              }`}
              onClick={() => switchProject(project.id)}
            >
              {project.id === activeProjectId ? (
                <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{project.name}</div>
                {project.description && (
                  <div className="text-[10px] text-zinc-600 truncate">{project.description}</div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeProject(project.id)
                }}
                className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-600 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
