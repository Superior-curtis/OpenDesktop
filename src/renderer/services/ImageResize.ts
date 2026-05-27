// ============================================================================
// Image Resize/Normalization Service
// Inspired by OpenCode's image service (https://github.com/anomalyco/opencode)
// ============================================================================

import { validateImage } from './BinaryImageDetection'

export interface ImageResizeConfig {
  maxWidth: number
  maxHeight: number
  maxBase64Bytes: number
  autoResize: boolean
  qualitySteps: number[]
  scaleStep: number
  maxIterations: number
}

export const DEFAULT_IMAGE_CONFIG: ImageResizeConfig = {
  maxWidth: 2000,
  maxHeight: 2000,
  maxBase64Bytes: 5 * 1024 * 1024,
  autoResize: true,
  qualitySteps: [80, 85, 70, 55, 40],
  scaleStep: 0.75,
  maxIterations: 32,
}

export interface ImageMetadata {
  width: number
  height: number
  mimeType: string
  sizeBytes: number
  hasAlpha?: boolean
}

export interface ResizeResult {
  resized: boolean
  dataUrl: string
  mimeType: string
  originalWidth: number
  originalHeight: number
  finalWidth: number
  finalHeight: number
  originalSize: number
  finalSize: number
  iterations: number
}

// ============================================================================
// Data URL Utilities
// ============================================================================

export function isDataUrl(str: string): boolean {
  return typeof str === 'string' && str.startsWith('data:')
}

export function parseDataUrl(dataUrl: string): { mimeType: string; base64: string; isBase64: boolean } {
  const matches = dataUrl.match(/^data:([^;]+);(?:base64)?,(.+)$/)
  if (!matches) {
    return { mimeType: 'image/png', base64: '', isBase64: false }
  }
  const mimeType = matches[1]
  const data = matches[2]
  const isBase64 = dataUrl.includes(';base64,')
  return { mimeType, base64: isBase64 ? data : btoa(data), isBase64 }
}

export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`
}

export function dataUrlToBytes(dataUrl: string): number {
  const { base64 } = parseDataUrl(dataUrl)
  if (!base64) return 0
  return Math.ceil(base64.length * 0.75)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================================
// Image Metadata Extraction
// ============================================================================

export function getImageMetadataFromBase64(base64: string): { width: number; height: number } | null {
  try {
    const raw = atob(base64.slice(0, Math.min(base64.length, 200)))
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

    if (width !== undefined && height !== undefined) {
      return { width, height }
    }
    return null
  } catch {
    return null
  }
}

export function getImageMetadata(dataUrl: string): ImageMetadata | null {
  if (!isDataUrl(dataUrl)) return null

  const { mimeType, base64 } = parseDataUrl(dataUrl)
  if (!base64) return null

  const sizeBytes = Math.ceil(base64.length * 0.75)
  const dims = getImageMetadataFromBase64(base64)

  let hasAlpha: boolean | undefined
  if (mimeType === 'image/png' && base64.length > 25) {
    try {
      const raw = atob(base64.slice(0, Math.min(base64.length, 50)))
      if (raw.length > 25) {
        const colorType = raw.charCodeAt(25)
        hasAlpha = colorType === 4 || colorType === 6
      }
    } catch {
      // header parse failed
    }
  }

  return {
    width: dims?.width ?? 0,
    height: dims?.height ?? 0,
    mimeType,
    sizeBytes,
    hasAlpha,
  }
}

// ============================================================================
// Dimension Helpers
// ============================================================================

export function dimensionsWithin(
  maxWidth: number,
  maxHeight: number,
  width: number,
  height: number
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }
  const ratio = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

// ============================================================================
// Canvas Resize
// ============================================================================

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

async function offscreenCanvasToDataUrl(
  canvas: OffscreenCanvas,
  mimeType: string,
  quality?: number
): Promise<string> {
  const blob = await canvas.convertToBlob({ type: mimeType, quality })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}

export async function resizeImageViaCanvas(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality?: number
): Promise<string> {
  const img = await loadImage(dataUrl)
  const { width: newWidth, height: newHeight } = dimensionsWithin(maxWidth, maxHeight, img.width, img.height)

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(newWidth, newHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get OffscreenCanvas rendering context')
    ctx.drawImage(img, 0, 0, newWidth, newHeight)
    const { mimeType } = parseDataUrl(dataUrl)
    return offscreenCanvasToDataUrl(canvas, mimeType, quality)
  }

  const canvas = document.createElement('canvas')
  canvas.width = newWidth
  canvas.height = newHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get Canvas rendering context')
  ctx.drawImage(img, 0, 0, newWidth, newHeight)
  const { mimeType } = parseDataUrl(dataUrl)
  return canvas.toDataURL(mimeType, quality)
}

// ============================================================================
// ImageResizer Class
// ============================================================================

export class ImageResizer {
  private config: ImageResizeConfig

  constructor(config?: Partial<ImageResizeConfig>) {
    this.config = { ...DEFAULT_IMAGE_CONFIG, ...config }
  }

  async resize(dataUrl: string): Promise<ResizeResult | { error: string }> {
    const validation = this.validate(dataUrl)
    if (!validation.valid) {
      return { error: validation.error ?? 'Invalid image data' }
    }

    const metadata = getImageMetadata(dataUrl)
    if (!metadata) {
      return { error: 'Failed to parse image metadata' }
    }

    const originalWidth = metadata.width
    const originalHeight = metadata.height
    const originalSize = metadata.sizeBytes

    if (!this.needsResize(metadata)) {
      return {
        resized: false,
        dataUrl,
        mimeType: metadata.mimeType,
        originalWidth,
        originalHeight,
        finalWidth: originalWidth,
        finalHeight: originalHeight,
        originalSize,
        finalSize: originalSize,
        iterations: 0,
      }
    }

    return this.performResize(dataUrl, metadata)
  }

  async resizeIfNeeded(dataUrl: string): Promise<ResizeResult> {
    const result = await this.resize(dataUrl)
    if ('error' in result) {
      const parsed = parseDataUrl(dataUrl)
      return {
        resized: false,
        dataUrl,
        mimeType: parsed.mimeType,
        originalWidth: 0,
        originalHeight: 0,
        finalWidth: 0,
        finalHeight: 0,
        originalSize: 0,
        finalSize: 0,
        iterations: 0,
      }
    }
    return result
  }

  validate(dataUrl: string): { valid: boolean; error?: string } {
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { valid: false, error: 'No data URL provided' }
    }
    if (!isDataUrl(dataUrl)) {
      return { valid: false, error: 'Invalid data URL format' }
    }
    return { valid: true }
  }

  setConfig(config: Partial<ImageResizeConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ImageResizeConfig {
    return { ...this.config }
  }

  private needsResize(metadata: ImageMetadata): boolean {
    if (!this.config.autoResize) return false
    return (
      metadata.width > this.config.maxWidth ||
      metadata.height > this.config.maxHeight ||
      metadata.sizeBytes > this.config.maxBase64Bytes
    )
  }

  private async performResize(
    dataUrl: string,
    metadata: ImageMetadata
  ): Promise<ResizeResult> {
    const { mimeType } = metadata
    let currentDataUrl = dataUrl
    let iterations = 0
    let scale = 1
    let qualityIdx = 0
    const supportsQuality = mimeType === 'image/jpeg' || mimeType === 'image/webp'
    const nSteps = this.config.qualitySteps.length

    while (iterations < this.config.maxIterations) {
      iterations++

      const scaledW = Math.round(metadata.width * scale)
      const scaledH = Math.round(metadata.height * scale)
      const { width: tw, height: th } = dimensionsWithin(
        this.config.maxWidth,
        this.config.maxHeight,
        scaledW,
        scaledH
      )

      const quality = supportsQuality ? this.config.qualitySteps[qualityIdx % nSteps] : undefined

      currentDataUrl = await resizeImageViaCanvas(currentDataUrl, tw, th, quality)
      const currentSize = dataUrlToBytes(currentDataUrl)

      if (currentSize <= this.config.maxBase64Bytes) {
        const dims = getImageMetadataFromBase64(parseDataUrl(currentDataUrl).base64)
        return {
          resized: true,
          dataUrl: currentDataUrl,
          mimeType,
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          finalWidth: dims?.width ?? tw,
          finalHeight: dims?.height ?? th,
          originalSize: metadata.sizeBytes,
          finalSize: currentSize,
          iterations,
        }
      }

      qualityIdx++
      if (!supportsQuality || qualityIdx % nSteps === 0) {
        scale *= this.config.scaleStep
      }
    }

    const finalSize = dataUrlToBytes(currentDataUrl)
    const dims = getImageMetadataFromBase64(parseDataUrl(currentDataUrl).base64)
    return {
      resized: true,
      dataUrl: currentDataUrl,
      mimeType,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      finalWidth: dims?.width ?? 0,
      finalHeight: dims?.height ?? 0,
      originalSize: metadata.sizeBytes,
      finalSize,
      iterations,
    }
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

export async function resizeBatch(
  dataUrls: string[],
  config?: Partial<ImageResizeConfig>
): Promise<ResizeResult[]> {
  const resizer = new ImageResizer(config)
  const results: ResizeResult[] = []
  for (const dataUrl of dataUrls) {
    const result = await resizer.resize(dataUrl)
    if ('error' in result) {
      results.push({
        resized: false,
        dataUrl,
        mimeType: 'image/png',
        originalWidth: 0,
        originalHeight: 0,
        finalWidth: 0,
        finalHeight: 0,
        originalSize: 0,
        finalSize: 0,
        iterations: 0,
      })
    } else {
      results.push(result)
    }
  }
  return results
}

// ============================================================================
// ImageStore Integration
// ============================================================================

export function getResizedImageStore(): { store: (dataUrl: string) => Promise<string | null> } {
  const resizer = new ImageResizer()
  return {
    store: async (dataUrl: string): Promise<string | null> => {
      const parsed = parseDataUrl(dataUrl)
      if (!parsed.base64) return null

      const validation = await validateImage(parsed.base64)
      if (!validation.valid) return null

      const result = await resizer.resizeIfNeeded(dataUrl)
      const { base64, mimeType } = parseDataUrl(result.dataUrl)
      const { getImageStore } = await import('./BinaryImageDetection')
      return getImageStore().store(base64, mimeType)
    },
  }
}
