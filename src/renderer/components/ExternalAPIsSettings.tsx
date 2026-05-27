import { useState } from 'react'
import { createExternalAPIService, ExternalAPIs } from '../services/ExternalAPIService'
import {
  Search,
  Plus,
  Trash2,
  Settings2,
  Eye,
  EyeOff,
  Globe,
  Thermometer,
} from 'lucide-react'

interface ExternalAPIsSettingsProps {
  externalAPIService: ReturnType<typeof createExternalAPIService>
}

export function ExternalAPIsSettings({ externalAPIService }: ExternalAPIsSettingsProps) {
  const [config, setConfig] = useState<ExternalAPIs>(externalAPIService.getConfig())
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  const handleWeatherUpdate = (field: string, value: any) => {
    externalAPIService.updateWeatherConfig({ [field]: value })
    setConfig(externalAPIService.getConfig())
  }

  const handleWebSearchUpdate = (field: string, value: any) => {
    externalAPIService.updateWebSearchConfig({ [field]: value })
    setConfig(externalAPIService.getConfig())
  }

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
        <Globe className="w-5 h-5" />
        External APIs
      </div>

      {/* Weather */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-zinc-100">Weather</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.weather.enabled}
              onChange={(e) => handleWeatherUpdate('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {config.weather.enabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Provider</label>
              <select
                value={config.weather.provider}
                onChange={(e) => handleWeatherUpdate('provider', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
              >
                <option value="openweather">OpenWeatherMap</option>
                <option value="weatherapi">WeatherAPI</option>
                <option value="accuweather">AccuWeather</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKeys['weather'] ? 'text' : 'password'}
                  value={config.weather.apiKey}
                  onChange={(e) => handleWeatherUpdate('apiKey', e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
                  placeholder="Enter API key"
                />
                <button
                  onClick={() => toggleApiKeyVisibility('weather')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showApiKeys['weather'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Default Location</label>
              <input
                type="text"
                value={config.weather.defaultLocation}
                onChange={(e) => handleWeatherUpdate('defaultLocation', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
                placeholder="e.g., London, UK"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Units</label>
              <select
                value={config.weather.units}
                onChange={(e) => handleWeatherUpdate('units', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
              >
                <option value="metric">Metric (°C)</option>
                <option value="imperial">Imperial (°F)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Web Search */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-green-400" />
            <span className="font-medium text-zinc-100">Web Search</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.webSearch.enabled}
              onChange={(e) => handleWebSearchUpdate('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>

        {config.webSearch.enabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Provider</label>
              <select
                value={config.webSearch.provider}
                onChange={(e) => handleWebSearchUpdate('provider', e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
              >
                <option value="firecrawl">Firecrawl</option>
                <option value="tavily">Tavily</option>
                <option value="serper">Serper</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">API Key</label>
              <div className="relative">
                <input
                  type={showApiKeys['websearch'] ? 'text' : 'password'}
                  value={config.webSearch.apiKey}
                  onChange={(e) => handleWebSearchUpdate('apiKey', e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
                  placeholder="Enter API key"
                />
                <button
                  onClick={() => toggleApiKeyVisibility('websearch')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showApiKeys['websearch'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Max Results</label>
              <input
                type="number"
                value={config.webSearch.maxResults}
                onChange={(e) => handleWebSearchUpdate('maxResults', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 text-sm"
                min={1}
                max={20}
              />
            </div>
          </div>
        )}
      </div>

      {/* Custom Endpoints */}
      <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-zinc-100">Custom Endpoints</span>
          </div>
          <button
            onClick={() => {
              externalAPIService.addCustomEndpoint({
                name: 'New Endpoint',
                url: '',
                method: 'GET',
                headers: {},
                description: '',
                enabled: true,
              })
              setConfig(externalAPIService.getConfig())
            }}
            className="flex items-center gap-1 px-2 py-1 bg-purple-600/20 text-purple-400 rounded-md text-sm hover:bg-purple-600/30"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {config.customEndpoints.length === 0 ? (
          <p className="text-sm text-zinc-500">No custom endpoints configured</p>
        ) : (
          <div className="space-y-3">
            {config.customEndpoints.map((endpoint) => (
              <div key={endpoint.id} className="p-3 bg-zinc-800/50 rounded-md border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <input
                    type="text"
                    value={endpoint.name}
                    onChange={(e) => {
                      externalAPIService.updateCustomEndpoint(endpoint.id, { name: e.target.value })
                      setConfig(externalAPIService.getConfig())
                    }}
                    className="bg-transparent font-medium text-zinc-100 text-sm"
                  />
                  <button
                    onClick={() => {
                      externalAPIService.removeCustomEndpoint(endpoint.id)
                      setConfig(externalAPIService.getConfig())
                    }}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={endpoint.url}
                  onChange={(e) => {
                    externalAPIService.updateCustomEndpoint(endpoint.id, { url: e.target.value })
                    setConfig(externalAPIService.getConfig())
                  }}
                  className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-100 text-xs mb-2"
                  placeholder="https://api.example.com/endpoint"
                />

                <div className="flex items-center gap-2">
                  <select
                    value={endpoint.method}
                    onChange={(e) => {
                      externalAPIService.updateCustomEndpoint(endpoint.id, { method: e.target.value as any })
                      setConfig(externalAPIService.getConfig())
                    }}
                    className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-100 text-xs"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={endpoint.enabled}
                      onChange={(e) => {
                        externalAPIService.updateCustomEndpoint(endpoint.id, { enabled: e.target.checked })
                        setConfig(externalAPIService.getConfig())
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
