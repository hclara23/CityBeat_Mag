import crypto from 'node:crypto'

export const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage'
export const GBP_CONNECTIONS = 'google_business_connections'

export type GbpState = { listingId: string; userId: string; locale: 'en' | 'es'; nonce: string; exp: number }
export type GbpLocation = {
  name: string
  title: string
  address?: string
  phone?: string
  website?: string
  description?: string
  hours?: Record<string, string>
}

function secret(name: 'GBP_OAUTH_STATE_SECRET' | 'GBP_TOKEN_ENCRYPTION_KEY'): string {
  const value = process.env[name]
  if (!value || value.length < 32) throw new Error(`${name} is not configured`)
  return value
}

export function signGbpState(input: Omit<GbpState, 'nonce' | 'exp'>, now = Date.now()): string {
  const state: GbpState = { ...input, nonce: crypto.randomBytes(18).toString('base64url'), exp: now + 10 * 60_000 }
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret('GBP_OAUTH_STATE_SECRET')).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyGbpState(value: string, now = Date.now()): GbpState {
  const [payload, signature] = value.split('.')
  if (!payload || !signature) throw new Error('Invalid OAuth state')
  const expected = crypto.createHmac('sha256', secret('GBP_OAUTH_STATE_SECRET')).update(payload).digest()
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw new Error('Invalid OAuth state')
  const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as GbpState
  if (!state.listingId || !state.userId || !state.nonce || state.exp < now) throw new Error('Expired OAuth state')
  return state
}

function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(secret('GBP_TOKEN_ENCRYPTION_KEY')).digest()
}

export function encryptGbpToken(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptGbpToken(value: string): string {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted token')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GBP_GOOGLE_CLIENT_ID && process.env.GBP_GOOGLE_CLIENT_SECRET && process.env.GBP_OAUTH_STATE_SECRET && process.env.GBP_TOKEN_ENCRYPTION_KEY)
}

export function googleOAuthRedirectUri(): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co').replace(/\/$/, '')}/api/google-business/callback`
}

export function googleAuthorizationUrl(state: string): string {
  const query = new URLSearchParams({ client_id: process.env.GBP_GOOGLE_CLIENT_ID || '', redirect_uri: googleOAuthRedirectUri(), response_type: 'code', scope: GBP_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state })
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`
}

export async function exchangeGoogleCode(code: string): Promise<{ refresh_token: string; access_token: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GBP_GOOGLE_CLIENT_ID || '', client_secret: process.env.GBP_GOOGLE_CLIENT_SECRET || '', redirect_uri: googleOAuthRedirectUri(), grant_type: 'authorization_code' }), signal: AbortSignal.timeout(10_000), cache: 'no-store' })
  const body = await response.json()
  if (!response.ok || !body.refresh_token) throw new Error(body.error_description || 'Google did not return an offline refresh token')
  return body
}

export async function refreshGoogleAccessToken(encryptedRefreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: decryptGbpToken(encryptedRefreshToken), client_id: process.env.GBP_GOOGLE_CLIENT_ID || '', client_secret: process.env.GBP_GOOGLE_CLIENT_SECRET || '', grant_type: 'refresh_token' }), signal: AbortSignal.timeout(10_000), cache: 'no-store' })
  const body = await response.json()
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Google access token refresh failed')
  return body.access_token
}

async function googleGet(url: string, accessToken: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(12_000), cache: 'no-store' })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || `Google Business Profile request failed (${response.status})`)
  return body
}

export async function discoverGbpLocations(accessToken: string): Promise<GbpLocation[]> {
  const accounts = await googleGet('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', accessToken)
  const found: GbpLocation[] = []
  for (const account of (accounts.accounts || []).slice(0, 10)) {
    const fields = 'name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile'
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=${encodeURIComponent(fields)}&pageSize=100`
    const body = await googleGet(url, accessToken)
    for (const location of body.locations || []) found.push(mapGoogleLocation(location))
  }
  return found
}

export async function fetchGbpLocation(accessToken: string, name: string): Promise<GbpLocation> {
  const fields = 'name,title,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile'
  return mapGoogleLocation(await googleGet(`https://mybusinessbusinessinformation.googleapis.com/v1/${name}?readMask=${encodeURIComponent(fields)}`, accessToken))
}

export function mapGoogleLocation(location: any): GbpLocation {
  const address = location.storefrontAddress
  const lines = [...(address?.addressLines || []), [address?.locality, address?.administrativeArea, address?.postalCode].filter(Boolean).join(' ')].filter(Boolean)
  const hours: Record<string, string> = {}
  for (const period of location.regularHours?.periods || []) {
    const day = String(period.openDay || '').toLowerCase()
    const key = day ? day[0].toUpperCase() + day.slice(1) : ''
    const format = (t: any) => `${String(t?.hours ?? 0).padStart(2, '0')}:${String(t?.minutes ?? 0).padStart(2, '0')}`
    if (key) hours[key] = `${format(period.openTime)}–${format(period.closeTime)}`
  }
  return { name: String(location.name || ''), title: String(location.title || ''), address: lines.join(', '), phone: location.phoneNumbers?.primaryPhone || '', website: location.websiteUri || '', description: location.profile?.description || '', hours }
}

export function gbpImportPatch(location: GbpLocation): Record<string, unknown> {
  return { name: location.title, address: location.address || '', phone: location.phone || '', website: location.website || '', description: location.description || '', hours: location.hours || {} }
}

const PERFORMANCE_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'CALL_CLICKS', 'WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS',
]

export async function fetchGbpPerformance(accessToken: string, locationName: string, days: number) {
  const end = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86400000)
  const params = new URLSearchParams()
  PERFORMANCE_METRICS.forEach(metric => params.append('dailyMetrics', metric))
  const parts = (prefix: string, date: Date) => { params.set(`${prefix}.year`, String(date.getUTCFullYear())); params.set(`${prefix}.month`, String(date.getUTCMonth() + 1)); params.set(`${prefix}.day`, String(date.getUTCDate())) }
  parts('dailyRange.startDate', start); parts('dailyRange.endDate', end)
  return googleGet(`https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params}`, accessToken)
}
