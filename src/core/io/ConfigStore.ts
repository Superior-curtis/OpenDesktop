export interface ConfigStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  getAllKeys(): string[]
}
