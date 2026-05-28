// Browser mode — direct API calls, no backend needed
export function setupBrowserMode(): boolean {
  if (typeof window === 'undefined') return false
  if ((window as any).electron) return false

  ;(window as any).api = {
    readFile: async () => '',
    writeFile: async () => false,
    executeCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
    glob: async () => [],
    grep: async () => [],

    webSearch: async (query: string, n?: number) => {
      try {
        const res = await fetch('https://lite.duckduckgo.com/lite/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'q=' + encodeURIComponent(query),
        })
        const html = await res.text()
        const results: any[] = []
        const lr = /<a[^>]*href="([^"]*)"[^>]*class='result-link'[^>]*>([^<]*)<\/a>/gi
        const sr = /<td class='result-snippet'>([\s\S]*?)<\/td>/gi
        const links: any[] = [], snippets: string[] = []
        let m: any
        while ((m = lr.exec(html)) !== null) { if (m[1] && m[2]) links.push({ url: m[1], title: m[2].replace(/<[^>]+>/g, '').trim() }) }
        while ((m = sr.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
        const limit = n || 5
        for (let i = 0; i < Math.min(links.length, snippets.length, limit); i++) {
          results.push({ title: links[i].title, url: links[i].url, description: (snippets[i] || '').slice(0, 300) })
        }
        return { success: true, results }
      } catch { return { success: false, results: [] } }
    },

    webFetch: async (url: string, max?: number) => {
      try {
        const res = await fetch(url)
        const html = await res.text()
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        return { success: true, content: text.slice(0, max || 50000) }
      } catch { return { success: false, content: '' } }
    },
  }

  ;(window as any).electron = {
    api: {
      chat: async (p: any) => {
        const parsed = typeof p.body === 'string' ? JSON.parse(p.body) : p.body
        try {
          if (p.providerType === 'google') {
            return googleChat(p.apiKey, parsed, p.stream)
          }
          if (p.providerType === 'anthropic') {
            return anthropicChat(p.apiKey, parsed)
          }
          return openaiChat(p.baseUrl, p.apiKey, parsed)
        } catch (e: any) { return { success: false, error: e.message } }
      },
      onStreamData: () => {},
      offStreamData: () => {},
      startStream: async () => ({ success: true }),
      testProvider: async () => ({ success: true }),
    },
    getAppVersion: async () => 'web-1.0.0',
    getPlatform: async () => navigator.platform || 'web',
    getUserDataPath: async () => '',
  }

  console.log('[OpenDesktop] Browser mode — ready')
  return true
}

async function googleChat(key: string, parsed: any, stream: boolean) {
  const model = parsed.model || 'gemini-2.0-flash'
  const contents = (parsed.messages || []).map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }))
  const body: any = { contents, generationConfig: { maxOutputTokens: parsed.max_tokens || 4096 } }
  if (parsed.system) body.systemInstruction = { parts: [{ text: parsed.system }] }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':' +
    (stream ? 'streamGenerateContent' : 'generateContent') + '?key=' + encodeURIComponent(key)

  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) return { success: false, error: await res.text() }
  if (!stream) {
    const data = await res.json()
    return { success: true, content: data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '' }
  }
  return { success: true, streamId: 'gemini-' + Date.now() }
}

async function anthropicChat(key: string, parsed: any) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: parsed.model, messages: parsed.messages, system: parsed.system, max_tokens: parsed.max_tokens || 4096, stream: false }),
  })
  if (!res.ok) return { success: false, error: await res.text() }
  const data = await res.json()
  return { success: true, content: data.content?.map((c: any) => c.text || '').join('') || '' }
}

async function openaiChat(baseUrl: string, key: string, parsed: any) {
  const url = (baseUrl || '').endsWith('/v1') ? baseUrl + '/chat/completions' : baseUrl + '/v1/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ ...parsed, stream: false }),
  })
  if (!res.ok) return { success: false, error: await res.text() }
  const data = await res.json()
  return { success: true, content: data.choices?.[0]?.message?.content || '' }
}
