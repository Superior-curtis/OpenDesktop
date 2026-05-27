export interface FileResult {
  content: string
  filePath: string
}

export interface WriteOptions {
  append?: boolean
}

export interface FileSystem {
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, content: string, options?: WriteOptions): Promise<void>
  glob(pattern: string, cwd?: string): Promise<string[]>
  grep(pattern: string, options?: { path?: string; include?: string }): Promise<{ file: string; line: number; content: string }[]>
  deleteFile(filePath: string): Promise<void>
  exists(filePath: string): Promise<boolean>
  mkdir(dirPath: string): Promise<void>
  readdir(dirPath: string): Promise<string[]>
}
