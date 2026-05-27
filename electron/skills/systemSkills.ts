import { Skill, SkillResult } from '../types'
import { screen, clipboard, mouse, keyboard } from '@nut-tree-fork/nut-js'
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export const systemSkills: Skill[] = [
  {
    id: 'screenshot',
    name: 'Screenshot',
    description: 'Take a screenshot of the current screen',
    icon: 'Monitor',
    category: 'system',
    params: [
      { name: 'path', type: 'string', description: 'Save path (optional)', required: false },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        const screenshot = await screen.grab()
        const path = params.path || join(process.env.TEMP || '.', `screenshot-${Date.now()}.png`)
        writeFileSync(path, screenshot.data)
        return {
          success: true,
          output: `Screenshot saved to ${path}`,
          data: { path },
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Screenshot failed: ${error}`,
        }
      }
    },
  },
  {
    id: 'mouse-move',
    name: 'Move Mouse',
    description: 'Move mouse to specific position',
    icon: 'MousePointer',
    category: 'system',
    params: [
      { name: 'x', type: 'number', description: 'X coordinate', required: true },
      { name: 'y', type: 'number', description: 'Y coordinate', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        await mouse.setPosition({ x: params.x, y: params.y })
        return { success: true, output: `Mouse moved to (${params.x}, ${params.y})` }
      } catch (error) {
        return { success: false, output: '', error: `Mouse move failed: ${error}` }
      }
    },
  },
  {
    id: 'mouse-click',
    name: 'Click Mouse',
    description: 'Click at current or specified position',
    icon: 'MousePointerClick',
    category: 'system',
    params: [
      { name: 'button', type: 'select', description: 'Mouse button', options: ['left', 'right', 'middle'] },
      { name: 'x', type: 'number', description: 'X coordinate (optional)', required: false },
      { name: 'y', type: 'number', description: 'Y coordinate (optional)', required: false },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        if (params.x !== undefined && params.y !== undefined) {
          await mouse.setPosition({ x: params.x, y: params.y })
        }
        await mouse.click(params.button === 'right' ? 2 : 1)
        return { success: true, output: `${params.button || 'left'} click performed` }
      } catch (error) {
        return { success: false, output: '', error: `Click failed: ${error}` }
      }
    },
  },
  {
    id: 'keyboard-type',
    name: 'Type Text',
    description: 'Type text using keyboard',
    icon: 'Keyboard',
    category: 'system',
    params: [
      { name: 'text', type: 'string', description: 'Text to type', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        await keyboard.type(params.text)
        return { success: true, output: `Typed: ${params.text}` }
      } catch (error) {
        return { success: false, output: '', error: `Type failed: ${error}` }
      }
    },
  },
  {
    id: 'keyboard-shortcut',
    name: 'Keyboard Shortcut',
    description: 'Execute keyboard shortcut',
    icon: 'Keyboard',
    category: 'system',
    params: [
      { name: 'keys', type: 'string', description: 'Keys separated by + (e.g., ctrl+c)', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        const keyList = params.keys.split('+').map((k: string) => k.trim().toLowerCase())
        const modifiers: any[] = []
        let mainKey: any = null

        const keyMap: Record<string, any> = {
          ctrl: 'LeftControl',
          alt: 'LeftAlt',
          shift: 'LeftShift',
          cmd: 'LeftSuper',
          enter: 'Enter',
          tab: 'Tab',
          escape: 'Escape',
          esc: 'Escape',
          delete: 'Delete',
          backspace: 'Backspace',
          space: 'Space',
          a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', h: 'H', i: 'I', j: 'J',
          k: 'K', l: 'L', m: 'M', n: 'N', o: 'O', p: 'P', q: 'Q', r: 'R', s: 'S', t: 'T',
          u: 'U', v: 'V', w: 'W', x: 'X', y: 'Y', z: 'Z',
        }

        for (const key of keyList) {
          if (['ctrl', 'alt', 'shift', 'cmd'].includes(key)) {
            modifiers.push(keyMap[key])
          } else {
            mainKey = keyMap[key] || key.toUpperCase()
          }
        }

        if (modifiers.length > 0) {
          await keyboard.pressKey(...modifiers)
        }
        await keyboard.pressKey(mainKey)
        await keyboard.releaseKey(mainKey)
        if (modifiers.length > 0) {
          await keyboard.releaseKey(...modifiers.reverse())
        }

        return { success: true, output: `Shortcut executed: ${params.keys}` }
      } catch (error) {
        return { success: false, output: '', error: `Shortcut failed: ${error}` }
      }
    },
  },
  {
    id: 'clipboard-read',
    name: 'Read Clipboard',
    description: 'Read current clipboard content',
    icon: 'Clipboard',
    category: 'system',
    execute: async (): Promise<SkillResult> => {
      try {
        const content = await clipboard.getContent()
        return { success: true, output: content || '(empty)' }
      } catch (error) {
        return { success: false, output: '', error: `Clipboard read failed: ${error}` }
      }
    },
  },
  {
    id: 'file-read',
    name: 'Read File',
    description: 'Read file contents',
    icon: 'FileText',
    category: 'file',
    params: [
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'encoding', type: 'select', description: 'Encoding', options: ['utf-8', 'base64'], required: false },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        if (!existsSync(params.path)) {
          return { success: false, output: '', error: `File not found: ${params.path}` }
        }
        const content = readFileSync(params.path, params.encoding || 'utf-8')
        return { success: true, output: content.toString().slice(0, 5000) }
      } catch (error) {
        return { success: false, output: '', error: `File read failed: ${error}` }
      }
    },
  },
  {
    id: 'file-write',
    name: 'Write File',
    description: 'Write content to file',
    icon: 'FileEdit',
    category: 'file',
    params: [
      { name: 'path', type: 'string', description: 'File path', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        writeFileSync(params.path, params.content, 'utf-8')
        return { success: true, output: `File written: ${params.path}` }
      } catch (error) {
        return { success: false, output: '', error: `File write failed: ${error}` }
      }
    },
  },
  {
    id: 'file-list',
    name: 'List Directory',
    description: 'List files in directory',
    icon: 'FolderOpen',
    category: 'file',
    params: [
      { name: 'path', type: 'string', description: 'Directory path', required: true },
    ],
    execute: async (params: Record<string, any>): Promise<SkillResult> => {
      try {
        if (!existsSync(params.path)) {
          return { success: false, output: '', error: `Directory not found: ${params.path}` }
        }
        const files = readdirSync(params.path)
        return { success: true, output: files.join('\n') }
      } catch (error) {
        return { success: false, output: '', error: `Directory list failed: ${error}` }
      }
    },
  },
]
