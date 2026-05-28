// Vercel serverless API — pure Node.js, no Express dependency

const API_BASE = 'https://lite.duckduckgo.com/lite/'

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  try {
    // Health
    if (path === '/api/health') {
      return res.json({ status: 'ok', version: '1.0.0' })
    }

    // Web Search — DuckDuckGo
    if (path === '/api/web-search') {
      const query = url.searchParams.get('q') || ''
      const limit = parseInt(url.searchParams.get('n') || '5')
      if (!query) return res.json({ results: [] })

      const ddgRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `q=${encodeURIComponent(query)}`,
      })
      const html = await ddgRes.text()

      const results: any[] = []
      const linkRx = /<a[^>]*href="([^"]*)"[^>]*class='result-link'[^>]*>([^<]*)<\/a>/gi
      const snipRx = /<td class='result-snippet'>([\s\S]*?)<\/td>/gi
      const links: { url: string; title: string }[] = []
      let m
      while ((m = linkRx.exec(html)) !== null) {
        const u = m[1], t = m[2].replace(/<[^>]+>/g, '').trim()
        if (u && t) links.push({ url: u, title: t })
      }
      const snippets: string[] = []
      while ((m = snipRx.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
      for (let i = 0; i < Math.min(links.length, snippets.length, limit); i++) {
        results.push({ title: links[i].title, url: links[i].url, description: snippets[i]?.slice(0, 300) || '' })
      }

      // Fallback
      if (results.length === 0) {
        const iaRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`)
        const ia: any = await iaRes.json()
        if (ia.AbstractText) {
          results.push({ title: ia.Heading || query, url: ia.AbstractURL || '', description: ia.AbstractText.slice(0, 300) })
        }
      }

      return res.json({ results })
    }

    // Web Fetch
    if (path === '/api/web-fetch') {
      const fetchUrl = url.searchParams.get('url')
      if (!fetchUrl) return res.json({ content: '' })
      const maxLen = parseInt(url.searchParams.get('max') || '50000')

      const fetchRes = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)' },
      })
      const html = await fetchRes.text()
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ').trim()

      return res.json({ content: text.slice(0, maxLen) })
    }

    // OpenAI-compatible chat
    if (path === '/api/chat' && req.method === 'POST') {
      const { baseUrl, apiKey, body } = req.body || {}
      const parsed = typeof body === 'string' ? JSON.parse(body) : body

      const chatUrl = baseUrl?.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...parsed, stream: false }),
      })

      if (!response.ok) {
        const err = await response.text()
        return res.status(response.status).json({ error: err })
      }

      const data: any = await response.json()
      return res.json({ content: data.choices?.[0]?.message?.content || '' })
    }

    // Anthropic chat
    if (path === '/api/anthropic-chat' && req.method === 'POST') {
      const { apiKey, body } = req.body || {}
      const parsed = typeof body === 'string' ? JSON.parse(body) : body

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: parsed.model,
          messages: parsed.messages,
          system: parsed.system,
          max_tokens: parsed.max_tokens || 4096,
          stream: false,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        return res.status(response.status).json({ error: err })
      }

      const data: any = await response.json()
      const content = data.content?.map((c: any) => c.text || '').join('') || ''
      return res.json({ content })
    }

    // Google Gemini chat (free tier — no credit card needed)
    if (path === '/api/google-chat' && req.method === 'POST') {
      const { apiKey, body } = req.body || {}
      const parsed = typeof body === 'string' ? JSON.parse(body) : body
      const model = parsed.model || 'gemini-2.0-flash'

      const contents = (parsed.messages || []).map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }))
      const reqBody: any = { contents, generationConfig: { maxOutputTokens: parsed.max_tokens || 4096 } }
      if (parsed.system) reqBody.systemInstruction = { parts: [{ text: parsed.system }] }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody),
      })
      if (!response.ok) { const err = await response.text(); return res.status(response.status).json({ error: err }) }
      const data: any = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
      return res.json({ content: text })
    }

    // 404
    return res.status(404).json({ error: 'Not found' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
