// Vercel serverless API entry point

import express from 'express'
import cors from 'cors'
import path from 'path'
const app = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Serve static frontend
const distPath = path.resolve(process.cwd(), 'dist')
app.use(express.static(distPath))

// ============================================================================
// Health
// ============================================================================
app.get('/api/health', (_req: any, res: any) => {
  res.json({ status: 'ok', platform: process.platform, version: '1.0.0' })
})

// ============================================================================
// OpenAI-compatible chat (streaming not supported in serverless)
// ============================================================================
app.post('/api/chat', async (req: any, res: any) => {
  try {
    const { baseUrl, apiKey, body } = req.body
    const parsed = typeof body === 'string' ? JSON.parse(body) : body

    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`
    const response = await fetch(url, {
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
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// Anthropic chat
// ============================================================================
app.post('/api/anthropic-chat', async (req: any, res: any) => {
  try {
    const { apiKey, body } = req.body
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
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// Web Search — DuckDuckGo (free)
// ============================================================================
app.get('/api/web-search', async (req: any, res: any) => {
  try {
    const query = req.query.q || ''
    const limit = parseInt(req.query.n) || 5
    if (!query) return res.json({ results: [] })

    const ddgRes = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)',
      },
      body: `q=${encodeURIComponent(query)}`,
    })
    const html = await ddgRes.text()

    const results: any[] = []
    const linkRegex = /<a[^>]*href="([^"]*)"[^>]*class='result-link'[^>]*>([^<]*)<\/a>/gi
    const snippetRegex = /<td class='result-snippet'>([\s\S]*?)<\/td>/gi
    const links: { url: string; title: string }[] = []
    let m
    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1], title = m[2].replace(/<[^>]+>/g, '').trim()
      if (url && title) links.push({ url, title })
    }
    const snippets: string[] = []
    while ((m = snippetRegex.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]+>/g, '').trim())
    for (let i = 0; i < Math.min(links.length, snippets.length, limit); i++) {
      results.push({ title: links[i].title, url: links[i].url, description: snippets[i]?.slice(0, 300) || '' })
    }

    // Fallback: Instant Answer API
    if (results.length === 0) {
      const iaRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`)
      const iaData: any = await iaRes.json()
      if (iaData.AbstractText) {
        results.push({ title: iaData.Heading || query, url: iaData.AbstractURL || '', description: iaData.AbstractText.slice(0, 300) })
      }
    }

    res.json({ results })
  } catch (err: any) {
    res.status(500).json({ error: err.message, results: [] })
  }
})

// ============================================================================
// Web Fetch
// ============================================================================
app.get('/api/web-fetch', async (req: any, res: any) => {
  try {
    const url = req.query.url as string
    if (!url) return res.json({ content: '' })
    const maxLen = parseInt(req.query.max) || 50000

    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)' },
    })
    const html = await fetchRes.text()
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ').trim()

    res.json({ content: text.slice(0, maxLen) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================================
// SPA fallback
// ============================================================================
app.use((_req: any, res: any) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Export for Vercel serverless
export default app
