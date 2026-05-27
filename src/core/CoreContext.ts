import { FileSystem, ProcessRunner, WebClient, ConfigStore, PlatformInfo, LLMClient } from './io'

export interface IOProvider {
  fileSystem: FileSystem
  processRunner: ProcessRunner
  webClient: WebClient
  configStore: ConfigStore
  platformInfo: PlatformInfo
  llmClient: LLMClient
}

let _currentProvider: IOProvider | null = null

export function setIOProvider(provider: IOProvider): void {
  _currentProvider = provider
}

export function getIOProvider(): IOProvider {
  if (!_currentProvider) {
    throw new Error('IOProvider not set. Call setIOProvider() before using core services.')
  }
  return _currentProvider
}

export function io(): IOProvider {
  return getIOProvider()
}
