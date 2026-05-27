// ============================================================================
// OAuth Flow (based on Claude Code's services/oauth/)
// Auth code listener, PKCE, token refresh, profile fetching, secure storage
// ============================================================================

export interface OAuthProvider {
  id: string
  name: string
  authUrl: string
  tokenUrl: string
  clientId: string
  scopes: string[]
  redirectUri: string
  pkce: boolean
}

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope: string
  tokenType: string
  idToken?: string
}

export interface OAuthProfile {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  provider: string
}

// ============================================================================
// PKCE Code Verifier & Challenge
// ============================================================================

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeVerifier(): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

function generateState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

// ============================================================================
// Auth Code Listener
// ============================================================================

export class AuthCodeListener {
  private server: { port: number; close: () => void } | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null

  async listen(port: number = 57483, timeoutMs: number = 300000): Promise<string> {
    return new Promise((resolve, reject) => {
      this.timeout = setTimeout(() => {
        this.close()
        reject(new Error('Auth timeout: user took too long to authorize'))
      }, timeoutMs)

      // Use message channel via the main process
      const handler = (data: any) => {
        if (data.type === 'auth_code' && data.code) {
          clearTimeout(this.timeout!)
          this.close()
          resolve(data.code)
        }
      }

      window.electron.api.onStreamData(handler)

      this.server = {
        port,
        close: () => {
          window.electron.api.offStreamData(handler)
        },
      }
    })
  }

  close(): void {
    if (this.timeout) clearTimeout(this.timeout)
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}

// ============================================================================
// OAuth Client
// ============================================================================

const TOKEN_STORE_KEY = 'opencode_oauth_tokens'

export class OAuthClient {
  private providers: Map<string, OAuthProvider> = new Map()
  private tokenCache: Map<string, OAuthTokens> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  registerProvider(provider: OAuthProvider): void {
    this.providers.set(provider.id, provider)
  }

  getProvider(id: string): OAuthProvider | undefined {
    return this.providers.get(id)
  }

  getRegisteredProviders(): OAuthProvider[] {
    return Array.from(this.providers.values())
  }

  // Start OAuth flow
  async authorize(
    providerId: string,
    forceRefresh: boolean = false,
  ): Promise<OAuthTokens> {
    const provider = this.providers.get(providerId)
    if (!provider) throw new Error(`Unknown OAuth provider: ${providerId}`)

    // Check cached tokens
    if (!forceRefresh) {
      const cached = this.tokenCache.get(providerId)
      if (cached && cached.expiresAt > Date.now() + 60000) {
        return cached
      }
      // Try refresh
      if (cached?.refreshToken) {
        try {
          const refreshed = await this.refreshToken(provider, cached.refreshToken)
          this.tokenCache.set(providerId, refreshed)
          this.saveToStorage()
          return refreshed
        } catch { /* fall through to full auth */ }
      }
    }

    // PKCE flow
    const state = generateState()
    let codeVerifier: string | undefined

    if (provider.pkce) {
      codeVerifier = await generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: provider.clientId,
        redirect_uri: provider.redirectUri,
        scope: provider.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })

      const authUrl = `${provider.authUrl}?${params.toString()}`
      await this.openAuthUrl(authUrl)
    } else {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: provider.clientId,
        redirect_uri: provider.redirectUri,
        scope: provider.scopes.join(' '),
        state,
      })

      const authUrl = `${provider.authUrl}?${params.toString()}`
      await this.openAuthUrl(authUrl)
    }

    // Wait for auth code
    const listener = new AuthCodeListener()
    const authCode = await listener.listen()

    // Exchange code for tokens
    const tokens = await this.exchangeCode(provider, authCode, codeVerifier)
    this.tokenCache.set(providerId, tokens)
    this.saveToStorage()
    return tokens
  }

  private async openAuthUrl(url: string): Promise<void> {
    // Open in browser
    try {
      await window.api.executeCommand(`start "${url}"`, { timeout: 5000 })
    } catch {
      // Fallback: try electron shell.openExternal
      if (typeof window.electron?.computer?.screenshot === 'function') {
        // Electron environment - use shell
        await window.api.executeCommand(`powershell start "${url}"`, { timeout: 5000 })
      }
    }
  }

  private async exchangeCode(
    provider: OAuthProvider,
    code: string,
    codeVerifier?: string,
  ): Promise<OAuthTokens> {
    const body: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirectUri,
      client_id: provider.clientId,
    }
    if (codeVerifier) body.code_verifier = codeVerifier

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${text}`)
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || '',
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token,
    }
  }

  private async refreshToken(
    provider: OAuthProvider,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: provider.clientId,
      }),
    })

    if (!response.ok) throw new Error(`Token refresh failed: ${response.status}`)

    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || '',
      tokenType: data.token_type || 'Bearer',
      idToken: data.id_token,
    }
  }

  async getProfile(providerId: string): Promise<OAuthProfile | null> {
    const tokens = this.tokenCache.get(providerId)
    if (!tokens || tokens.expiresAt < Date.now()) return null

    try {
      // Generic userinfo endpoint
      const response = await fetch('https://api.github.com/user', {
        headers: { Authorization: `${tokens.tokenType} ${tokens.accessToken}` },
      })
      if (!response.ok) return null
      const data = await response.json()

      return {
        id: String(data.id),
        name: data.name || data.login || 'Unknown',
        email: data.email,
        avatarUrl: data.avatar_url,
        provider: providerId,
      }
    } catch {
      return null
    }
  }

  getTokens(providerId: string): OAuthTokens | undefined {
    return this.tokenCache.get(providerId)
  }

  isAuthenticated(providerId: string): boolean {
    const tokens = this.tokenCache.get(providerId)
    return !!tokens && tokens.expiresAt > Date.now()
  }

  clearTokens(providerId: string): void {
    this.tokenCache.delete(providerId)
    this.saveToStorage()
  }

  clearAll(): void {
    this.tokenCache.clear()
    localStorage.removeItem(TOKEN_STORE_KEY)
  }

  private saveToStorage(): void {
    try {
      const data: Record<string, OAuthTokens> = {}
      for (const [key, val] of this.tokenCache) {
        data[key] = val
      }
      localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(TOKEN_STORE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      for (const [key, val] of Object.entries(data)) {
        this.tokenCache.set(key, val as OAuthTokens)
      }
    } catch { /* ignore */ }
  }
}

// ============================================================================
// Default OAuth Providers
// ============================================================================

export function registerDefaultProviders(client: OAuthClient): void {
  client.registerProvider({
    id: 'github',
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: 'opencode-desktop',
    scopes: ['read:user', 'repo'],
    redirectUri: 'http://localhost:57483/callback',
    pkce: true,
  })

  client.registerProvider({
    id: 'anthropic',
    name: 'Anthropic',
    authUrl: 'https://auth.anthropic.com/authorize',
    tokenUrl: 'https://auth.anthropic.com/oauth/token',
    clientId: 'opencode-desktop',
    scopes: ['user:read', 'usage:read'],
    redirectUri: 'http://localhost:57483/callback',
    pkce: true,
  })
}

// ============================================================================
// Singleton
// ============================================================================

let globalOAuthClient: OAuthClient | null = null

export function getOAuthClient(): OAuthClient {
  if (!globalOAuthClient) {
    globalOAuthClient = new OAuthClient()
    registerDefaultProviders(globalOAuthClient)
  }
  return globalOAuthClient
}
