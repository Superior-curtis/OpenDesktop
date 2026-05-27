// ============================================================================
// Binary/Image Detection (based on Claude Code's image handling)
// Extension detection, validation, caching, clipboard capture
// ============================================================================

export const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.markdown',
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.jsonc', '.json5', '.yaml', '.yml', '.toml',
  '.css', '.scss', '.less', '.sass',
  '.html', '.htm', '.xhtml',
  '.xml', '.svg', '.xslt',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.cs', '.fs', '.sql',
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.env', '.gitignore', '.dockerfile',
  '.vue', '.svelte', '.astro',
  '.php', '.pl', '.pm', '.lua',
  '.graphql', '.gql',
  '.lock', '.config', '.npmrc',
  '.eslintrc', '.prettierrc', '.babelrc',
  '.claude.md', 'claude.md',
])

export const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
])

export const BINARY_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib',
  '.o', '.obj', '.a', '.lib',
  '.class', '.jar', '.war',
  '.pyc', '.pyo',
  '.wasm',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.flv',
  '.ico', '.cur',
])

const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGE_STORE_ENTRIES = 200

// ============================================================================
// Extension Detection
// ============================================================================

export function isTextFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  // Check filename without extension (like 'Makefile', 'Dockerfile', 'claude.md')
  const basename = lower.split('/').pop() ?? lower
  if (basename && TEXT_EXTENSIONS.has(basename)) return true
  // Default: no known binary extension → treat as text
  return !hasBinaryExtension(filePath)
}

export function hasBinaryExtension(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  for (const ext of BINARY_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

export function isImageFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  for (const ext of IMAGE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true
  }
  return false
}

export function getBinaryExtensionsList(): string {
  return Array.from(BINARY_EXTENSIONS).join(', ')
}

export function getTextExtensionsList(): string {
  return Array.from(TEXT_EXTENSIONS).filter(e => e.startsWith('.')).join(', ')
}

// ============================================================================
// Image Validation
// ============================================================================

export interface ImageValidationResult {
  valid: boolean
  width?: number
  height?: number
  sizeBytes: number
  error?: string
}

export async function validateImage(base64Data: string): Promise<ImageValidationResult> {
  const sizeBytes = Math.ceil(base64Data.length * 0.75) // base64 → raw bytes

  if (sizeBytes > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      sizeBytes,
      error: `Image too large: ${formatBytes(sizeBytes)} (max: ${formatBytes(MAX_IMAGE_SIZE)})`,
    }
  }

  // Try to extract dimensions from the base64 data's PNG/JPEG header
  const raw = atob(base64Data.slice(0, Math.min(base64Data.length, 200)))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

  let width: number | undefined
  let height: number | undefined

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    // PNG: width at offset 16, height at offset 20 (big-endian)
    if (bytes.length >= 24) {
      width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
      height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    }
  } else if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    // JPEG: scan for SOF markers (0xFF 0xC0-0xCF)
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] >= 0xC0 && bytes[i + 1] <= 0xCF) {
        width = (bytes[i + 5] << 8) | bytes[i + 6]
        height = (bytes[i + 7] << 8) | bytes[i + 8]
        break
      }
    }
  }

  return { valid: true, width, height, sizeBytes }
}

// ============================================================================
// Image Store (cache management)
// ============================================================================

interface CachedImage {
  id: string
  data: string
  mimeType: string
  sizeBytes: number
  width?: number
  height?: number
  createdAt: number
  lastAccessed: number
  sessionId?: string
}

export class ImageStore {
  private images: Map<string, CachedImage> = new Map()
  private accessOrder: string[] = []

  store(data: string, mimeType: string = 'image/png', sessionId?: string): string {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const entry: CachedImage = {
      id,
      data,
      mimeType,
      sizeBytes: data.length,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      sessionId,
    }

    this.images.set(id, entry)
    this.accessOrder.push(id)
    this.evict()
    return id
  }

  get(id: string): CachedImage | undefined {
    const entry = this.images.get(id)
    if (entry) {
      entry.lastAccessed = Date.now()
    }
    return entry
  }

  getDataUri(id: string): string | undefined {
    const entry = this.get(id)
    if (!entry) return undefined
    return `data:${entry.mimeType};base64,${entry.data}`
  }

  remove(id: string): boolean {
    this.accessOrder = this.accessOrder.filter((i) => i !== id)
    return this.images.delete(id)
  }

  clearSession(sessionId: string): void {
    const toRemove: string[] = []
    for (const [id, entry] of this.images) {
      if (entry.sessionId === sessionId) toRemove.push(id)
    }
    for (const id of toRemove) this.remove(id)
  }

  clearAll(): void {
    this.images.clear()
    this.accessOrder = []
  }

  private evict(): void {
    while (this.images.size > MAX_IMAGE_STORE_ENTRIES) {
      const oldest = this.accessOrder.shift()
      if (oldest) this.images.delete(oldest)
    }
  }

  getCount(): number {
    return this.images.size
  }

  getTotalBytes(): number {
    let total = 0
    for (const entry of this.images.values()) total += entry.sizeBytes
    return total
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Singleton
// ============================================================================

let globalImageStore: ImageStore | null = null

export function getImageStore(): ImageStore {
  if (!globalImageStore) globalImageStore = new ImageStore()
  return globalImageStore
}

export function resetImageStore(): void {
  globalImageStore?.clearAll()
  globalImageStore = null
}
