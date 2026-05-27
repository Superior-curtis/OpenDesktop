export interface WeatherConfig {
  enabled: boolean
  apiKey: string
  provider: 'openweather' | 'weatherapi' | 'accuweather'
  defaultLocation: string
  units: 'metric' | 'imperial'
}

export interface WebSearchConfig {
  enabled: boolean
  provider: 'firecrawl' | 'tavily' | 'serper'
  apiKey: string
  maxResults: number
}

export interface ExternalAPIs {
  weather: WeatherConfig
  webSearch: WebSearchConfig
  customEndpoints: CustomEndpoint[]
}

export interface CustomEndpoint {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: Record<string, string>
  description: string
  enabled: boolean
}

const DEFAULT_EXTERNAL_APIS: ExternalAPIs = {
  weather: {
    enabled: false,
    apiKey: '',
    provider: 'openweather',
    defaultLocation: '',
    units: 'metric',
  },
  webSearch: {
    enabled: false,
    provider: 'firecrawl',
    apiKey: '',
    maxResults: 5,
  },
  customEndpoints: [],
}

export class ExternalAPIService {
  private config: ExternalAPIs
  private onConfigChange?: (config: ExternalAPIs) => void

  constructor(config: Partial<ExternalAPIs> = {}) {
    this.config = { ...DEFAULT_EXTERNAL_APIS, ...config }
  }

  setCallbacks(callbacks: {
    onConfigChange?: (config: ExternalAPIs) => void
  }) {
    this.onConfigChange = callbacks.onConfigChange
  }

  getConfig(): ExternalAPIs {
    return { ...this.config }
  }

  updateConfig(updates: Partial<ExternalAPIs>): void {
    this.config = { ...this.config, ...updates }
    this.onConfigChange?.(this.config)
  }

  updateWeatherConfig(updates: Partial<WeatherConfig>): void {
    this.config.weather = { ...this.config.weather, ...updates }
    this.onConfigChange?.(this.config)
  }

  updateWebSearchConfig(updates: Partial<WebSearchConfig>): void {
    this.config.webSearch = { ...this.config.webSearch, ...updates }
    this.onConfigChange?.(this.config)
  }

  addCustomEndpoint(endpoint: Omit<CustomEndpoint, 'id'>): CustomEndpoint {
    const newEndpoint: CustomEndpoint = {
      ...endpoint,
      id: `endpoint-${Date.now()}`,
    }
    this.config.customEndpoints.push(newEndpoint)
    this.onConfigChange?.(this.config)
    return newEndpoint
  }

  removeCustomEndpoint(id: string): void {
    this.config.customEndpoints = this.config.customEndpoints.filter((e) => e.id !== id)
    this.onConfigChange?.(this.config)
  }

  updateCustomEndpoint(id: string, updates: Partial<CustomEndpoint>): void {
    this.config.customEndpoints = this.config.customEndpoints.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    )
    this.onConfigChange?.(this.config)
  }

  async getWeather(location?: string): Promise<any> {
    if (!this.config.weather.enabled || !this.config.weather.apiKey) {
      return { error: 'Weather API not configured' }
    }

    const loc = location || this.config.weather.defaultLocation
    if (!loc) {
      return { error: 'No location specified' }
    }

    try {
      const { provider, apiKey, units } = this.config.weather

      if (provider === 'openweather') {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(loc)}&appid=${apiKey}&units=${units}`
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return await response.json()
      }

      return { error: `Provider ${provider} not implemented` }
    } catch (error) {
      return { error: `Failed to fetch weather: ${error}` }
    }
  }

  async webSearch(query: string): Promise<any[]> {
    if (!this.config.webSearch.enabled || !this.config.webSearch.apiKey) {
      return []
    }

    try {
      const { provider, apiKey, maxResults } = this.config.webSearch

      if (provider === 'firecrawl') {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            limit: maxResults,
          }),
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        return data.data || []
      }

      return []
    } catch (error) {
      console.error('Web search failed:', error)
      return []
    }
  }

  async callCustomEndpoint(id: string, params?: Record<string, any>): Promise<any> {
    const endpoint = this.config.customEndpoints.find((e) => e.id === id)
    if (!endpoint || !endpoint.enabled) {
      return { error: 'Endpoint not found or disabled' }
    }

    try {
      const url = new URL(endpoint.url)
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.set(key, String(value))
        })
      }

      const response = await fetch(url.toString(), {
        method: endpoint.method,
        headers: endpoint.headers,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      return { error: `Endpoint call failed: ${error}` }
    }
  }

  reset(): void {
    this.config = { ...DEFAULT_EXTERNAL_APIS }
    this.onConfigChange?.(this.config)
  }
}

export function createExternalAPIService(config?: Partial<ExternalAPIs>): ExternalAPIService {
  return new ExternalAPIService(config)
}
