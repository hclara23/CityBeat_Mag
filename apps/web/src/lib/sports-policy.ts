export type SportsSource = {
  name: string; enabled: boolean; permission_basis: string; permission_evidence: string
  permission_expires: string; token_hash?: string
}
export type SportsUpdate = { title: string; body: string; author: string; published_at: string; source_url: string | null; external_id: string }

export function permittedSource(source: SportsSource | undefined, now = Date.now()): boolean {
  return Boolean(source?.enabled && ['owned', 'written_permission', 'licensed'].includes(source.permission_basis) &&
    source.permission_evidence?.trim().length >= 10 && Date.parse(source.permission_expires) > now)
}
export function sportsUpdate(input: Record<string, unknown>, now = Date.now()): SportsUpdate {
  const field = (name: string, min: number, max: number) => {
    const value = input[name]
    if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw new Error(`Invalid ${name}`)
    return value.trim()
  }
  const title = field('title', 5, 180)
  const body = field('body', 20, 4000)
  const author = field('author', 2, 100)
  const external_id = field('external_id', 1, 120)
  const date = field('published_at', 10, 40)
  const timestamp = Date.parse(date)
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60_000 || timestamp < now - 7 * 86400_000) throw new Error('Publication date must be within the last seven days')
  let source_url: string | null = null
  if (input.source_url) {
    if (typeof input.source_url !== 'string' || input.source_url.length > 1000) throw new Error('Invalid source URL')
    const url = new URL(input.source_url)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Source URL must use HTTPS')
    source_url = url.href
  }
  // Content is displayed as text, never HTML. No external images are imported.
  return { title, body, author, external_id, source_url, published_at: new Date(timestamp).toISOString() }
}
