import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const PIXEL_EVENTS = ['page_view', 'conversion', 'lead', 'purchase'] as const
export type PixelEvent = (typeof PIXEL_EVENTS)[number]

export function isPixelEvent(value: unknown): value is PixelEvent {
  return (PIXEL_EVENTS as readonly unknown[]).includes(value)
}

export function normalizePixelDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase()
  if (!raw || raw.length > 253) return null
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    const hostname = url.hostname.replace(/^www\./, '').replace(/\.$/, '')
    if (!hostname || hostname.includes('/') || !/^[a-z0-9.-]+$/.test(hostname)) return null
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return hostname
    if (!hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.')) return null
    return hostname
  } catch {
    return null
  }
}

export function normalizePixelDomains(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(normalizePixelDomain).filter((v): v is string => Boolean(v)))].slice(0, 5)
}

export function originHostname(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

export function isAllowedPixelOrigin(origin: string | null, domains: string[]): boolean {
  const host = originHostname(origin)
  return Boolean(host && domains.some((domain) => host === domain || host.endsWith(`.${domain}`)))
}

export function generatePixelKey(): string {
  return randomBytes(24).toString('base64url')
}

export function hashPixelKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function pixelKeyMatches(key: string, hash: string): boolean {
  const candidate = Buffer.from(hashPixelKey(key), 'hex')
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function pixelStatField(event: PixelEvent): 'external_site_view' | 'external_conversion' {
  return event === 'page_view' ? 'external_site_view' : 'external_conversion'
}
