// Print appearances are editorial records, never a paid-tier entitlement.
export const PRINT_TYPES = ['cover', 'editorial', 'advertisement'] as const
export type PrintType = (typeof PRINT_TYPES)[number]
export type PrintRecognition = {
  id: string
  type: PrintType
  issue: string
  issue_es: string
  title: string
  title_es: string
  image_url: string
  issue_url: string
}
export const PRINT_LABELS: Record<PrintType, { en: string; es: string }> = {
  cover: { en: 'Cover Feature', es: 'En portada' },
  editorial: { en: 'Print Coverage', es: 'Artículo en la revista' },
  advertisement: { en: 'Print Advertiser', es: 'Anunciante en la revista' },
}
function text(v: unknown, max: number) { return typeof v === 'string' ? v.trim().slice(0, max) : '' }
function url(v: unknown, artwork = false): string {
  if (!v) return ''
  if (typeof v !== 'string' || v.length > 500) throw new Error('Invalid print evidence URL')
  // Relative, same-origin magazine artwork is supported; never protocol-relative.
  if (/^\/print\/[a-zA-Z0-9/_-]+\.(webp|jpg|png)$/.test(v)) return v
  try {
    const u = new URL(v)
    const allowedArtwork = ['storage.googleapis.com', 'firebasestorage.googleapis.com'].includes(u.hostname)
    if (u.protocol === 'https:' && !u.username && !u.password && (!artwork || allowedArtwork)) return u.href
  } catch {}
  if (artwork) throw new Error('Artwork must use approved Google storage or a /print/ artwork path')
  throw new Error('Print evidence must use an HTTPS URL or /print/ artwork path')
}
export function parsePrintRecognition(value: unknown): PrintRecognition[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Provide at most 20 print appearances')
  const ids = new Set<string>()
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid print appearance')
    const row = entry as Record<string, unknown>
    const id = text(row.id, 64)
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Print appearance IDs must be unique')
    ids.add(id)
    if (!PRINT_TYPES.includes(row.type as PrintType)) throw new Error('Invalid print appearance type')
    const issue = text(row.issue, 100)
    if (!issue) throw new Error('An issue label is required')
    return { id, type: row.type as PrintType, issue, issue_es: text(row.issue_es, 100) || issue,
      title: text(row.title, 180), title_es: text(row.title_es, 180), image_url: url(row.image_url, true), issue_url: url(row.issue_url) }
  })
}
export function publicPrintRecognition(value: unknown): PrintRecognition[] {
  try { return parsePrintRecognition(value).sort((a, b) => PRINT_TYPES.indexOf(a.type) - PRINT_TYPES.indexOf(b.type)) }
  catch { return [] }
}
