declare module 'glob' {
  export interface GlobOptions {
    cwd?: string
    nodir?: boolean
    absolute?: boolean
    ignore?: string | string[]
    dot?: boolean
  }

  export function glob(pattern: string, options?: GlobOptions): Promise<string[]>
  export function globSync(pattern: string, options?: GlobOptions): string[]
}
