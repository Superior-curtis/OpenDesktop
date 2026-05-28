"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const util_1 = require("util");
const glob_1 = require("glob");
const execAsync = (0, util_1.promisify)(child_process_1.execFile);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3456;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
// Serve static frontend
const distPath = path_1.default.join(__dirname, '..', 'dist');
app.use(express_1.default.static(distPath));
// ============================================================================
// Health check
// ============================================================================
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', platform: process.platform, version: '1.0.0' });
});
// ============================================================================
// AI Chat — OpenAI-compatible
// ============================================================================
app.post('/api/chat', async (req, res) => {
    try {
        const { baseUrl, apiKey, body, stream } = req.body;
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ ...parsed, stream: !!stream }),
        });
        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }
        if (!stream) {
            const data = await response.json();
            return res.json({ content: data.choices?.[0]?.message?.content || '' });
        }
        // SSE streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (!response.body)
            return res.end();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                res.write('data: [DONE]\n\n');
                res.end();
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            while (true) {
                const i = buffer.indexOf('\n');
                if (i === -1)
                    break;
                const line = buffer.slice(0, i).trim();
                buffer = buffer.slice(i + 1);
                if (line.startsWith('data: '))
                    res.write(line + '\n\n');
            }
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============================================================================
// AI Chat — Anthropic
// ============================================================================
app.post('/api/anthropic-chat', async (req, res) => {
    try {
        const { apiKey, body, stream } = req.body;
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
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
                stream: !!stream,
                ...(parsed.temperature !== undefined ? { temperature: parsed.temperature } : {}),
            }),
        });
        if (!response.ok) {
            const err = await response.text();
            return res.status(response.status).json({ error: err });
        }
        if (!stream) {
            const data = await response.json();
            const content = data.content?.map((c) => c.text || '').join('') || '';
            return res.json({ content });
        }
        // SSE streaming — convert Anthropic events to OpenAI format
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        if (!response.body)
            return res.end();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                res.write('data: [DONE]\n\n');
                res.end();
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            while (true) {
                const i = buffer.indexOf('\n');
                if (i === -1)
                    break;
                const line = buffer.slice(0, i).trim();
                buffer = buffer.slice(i + 1);
                if (line.startsWith('data: ')) {
                    try {
                        const evt = JSON.parse(line.slice(6));
                        if (evt.type === 'content_block_delta' && evt.delta?.text) {
                            const chunk = JSON.stringify({ choices: [{ delta: { content: evt.delta.text } }] });
                            res.write(`data: ${chunk}\n\n`);
                        }
                    }
                    catch { }
                }
            }
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============================================================================
// Web Search — DuckDuckGo (free)
// ============================================================================
app.get('/api/web-search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const limit = parseInt(req.query.n) || 5;
        if (!query)
            return res.json({ results: [] });
        const ddgRes = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)' },
        });
        const html = await ddgRes.text();
        const results = [];
        const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        const snippetRegex = /<td class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
        const links = [];
        let m;
        while ((m = linkRegex.exec(html)) !== null) {
            const url = m[1], title = m[2].replace(/<[^>]+>/g, '').trim();
            if (url.startsWith('http') && title && !url.includes('duckduckgo.com'))
                links.push({ url, title });
        }
        const snippets = [];
        while ((m = snippetRegex.exec(html)) !== null)
            snippets.push(m[1].replace(/<[^>]+>/g, '').trim());
        for (let i = 0; i < Math.min(links.length, snippets.length, limit); i++) {
            results.push({ title: links[i].title, url: links[i].url, description: snippets[i].slice(0, 300) });
        }
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: err.message, results: [] });
    }
});
// ============================================================================
// Web Fetch
// ============================================================================
app.get('/api/web-fetch', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url)
            return res.json({ content: '' });
        const maxLen = parseInt(req.query.max) || 50000;
        const fetchRes = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenDesktop/1.0)' },
        });
        const html = await fetchRes.text();
        const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ').trim();
        res.json({ content: text.slice(0, maxLen) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============================================================================
// File system
// ============================================================================
app.post('/api/fs/read', async (req, res) => {
    try {
        const p = req.body.path;
        if (!p)
            return res.status(400).json({ error: 'path required' });
        const content = await (0, promises_1.readFile)(p, 'utf-8');
        res.json({ content });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/fs/write', async (req, res) => {
    try {
        await (0, promises_1.writeFile)(req.body.path, req.body.content, 'utf-8');
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/fs/exec', async (req, res) => {
    try {
        const cmd = req.body.command;
        const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
        const args = process.platform === 'win32' ? ['-NoProfile', '-Command', cmd] : ['-c', cmd];
        const { stdout, stderr } = await execAsync(shell, args, { timeout: 30000, env: process.env });
        res.json({ stdout: stdout.trim(), stderr: stderr.trim() });
    }
    catch (err) {
        res.json({ stdout: err.stdout?.trim() || '', stderr: err.stderr?.trim() || err.message });
    }
});
app.post('/api/fs/glob', async (req, res) => {
    try {
        const files = await (0, glob_1.glob)(req.body.pattern, { cwd: req.body.cwd || process.cwd(), dot: true });
        res.json({ files });
    }
    catch (err) {
        res.status(500).json({ error: err.message, files: [] });
    }
});
app.post('/api/fs/grep', async (req, res) => {
    try {
        const cwd = req.body.cwd || process.cwd();
        const pattern = req.body.pattern;
        const globPattern = req.body.glob || '**/*';
        const files = await (0, glob_1.glob)(globPattern, { cwd, nodir: true, ignore: 'node_modules/**' });
        const results = [];
        const regex = new RegExp(pattern, 'i');
        for (const f of files.slice(0, 100)) {
            try {
                const content = await (0, promises_1.readFile)(f, 'utf-8');
                content.split('\n').forEach((line, i) => {
                    if (regex.test(line))
                        results.push({ file: f, line: i + 1, content: line.trim().slice(0, 200) });
                });
            }
            catch { }
        }
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: err.message, results: [] });
    }
});
// ============================================================================
// SPA fallback
// ============================================================================
app.use((_req, res) => {
    res.sendFile(path_1.default.join(distPath, 'index.html'));
});
app.listen(PORT, () => {
    console.log(`OpenDesktop Web Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
