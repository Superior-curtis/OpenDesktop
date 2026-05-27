export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  content?: string
}

export interface WebClient {
  fetch(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string; maxLength?: number }): Promise<string>
  search(query: string, numResults?: number): Promise<WebSearchResult[]>
}
