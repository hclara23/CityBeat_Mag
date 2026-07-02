// Real event ingestion for the El Paso / Las Cruces / Ciudad Juárez area via the
// Ticketmaster Discovery API (free tier: https://developer.ticketmaster.com).
// Env-gated on TICKETMASTER_API_KEY — without it the sync is a clean no-op.

export interface ScrapedEvent {
  external_id: string
  title_en: string
  title_es: string
  meta_en: string
  meta_es: string
  image_url: string
  ticket_url: string
  start_date: string
  venue: string | null
}

const EL_PASO_LATLONG = '31.7619,-106.4850'
const RADIUS_MILES = '75' // covers Las Cruces and the borderland

function pickImage(images: any[]): string {
  if (!Array.isArray(images) || images.length === 0) return ''
  // Prefer a wide 16:9 image large enough for the event cards.
  const wide = images
    .filter((i) => i?.url && (i.ratio === '16_9' || !i.ratio))
    .sort((a, b) => (b.width || 0) - (a.width || 0))
  return wide[0]?.url || images[0]?.url || ''
}

export async function fetchTicketmasterEvents(): Promise<ScrapedEvent[]> {
  const key = (process.env.TICKETMASTER_API_KEY || '').trim()
  if (!key) return []

  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url =
    'https://app.ticketmaster.com/discovery/v2/events.json' +
    `?apikey=${encodeURIComponent(key)}` +
    `&latlong=${EL_PASO_LATLONG}&radius=${RADIUS_MILES}&unit=miles` +
    `&size=100&sort=date,asc&startDateTime=${encodeURIComponent(startDateTime)}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Ticketmaster API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const data: any = await res.json()
  const raw: any[] = data?._embedded?.events || []

  const seen = new Set<string>()
  const events: ScrapedEvent[] = []
  for (const ev of raw) {
    if (!ev?.id || !ev?.name) continue
    if (seen.has(ev.id)) continue
    seen.add(ev.id)

    const start = ev.dates?.start?.dateTime || (ev.dates?.start?.localDate ? `${ev.dates.start.localDate}T19:00:00` : null)
    if (!start) continue

    const venueObj = ev._embedded?.venues?.[0]
    const venueName = venueObj?.name || null
    const city = venueObj?.city?.name || ''
    const meta = [venueName, city].filter(Boolean).join(', ')

    events.push({
      external_id: ev.id,
      title_en: String(ev.name).slice(0, 200),
      // Venue/artist names are proper nouns — the events page falls back to
      // title_en when title_es is empty, so no translation pass is needed here.
      title_es: '',
      meta_en: meta,
      meta_es: meta,
      image_url: pickImage(ev.images),
      ticket_url: ev.url || '',
      start_date: new Date(start).toISOString(),
      venue: venueName,
    })
  }
  return events
}
