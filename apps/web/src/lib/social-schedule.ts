export const QUEUE_TIMEZONE = 'America/Denver'
export const QUEUE_HOURS = [6, 12, 18] as const
export const SLOT_GRACE_MS = 30 * 60_000
export const PREPARATION_LEAD_MS = 30 * 60_000
const localTime = new Intl.DateTimeFormat('en-CA', { timeZone: QUEUE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function slotParts(time: number) {
  const parts = Object.fromEntries(localTime.formatToParts(time).map(p => [p.type, p.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) }
}

export function isSlot(time: number) {
  if (!Number.isFinite(time) || time % 60_000 !== 0) return false
  const p = slotParts(time)
  return p.minute === 0 && (QUEUE_HOURS as readonly number[]).includes(p.hour)
}

// Walk UTC hours but recognize slots in local time: DST never shifts wall-clock slots.
export function nextSlot(now: number, occupied: Record<string, string>, notBefore = now + PREPARATION_LEAD_MS) {
  const earliest = Math.max(now + PREPARATION_LEAD_MS, notBefore)
  for (let t = Math.ceil(earliest / 3_600_000) * 3_600_000; t < now + 120 * 86400_000; t += 3_600_000) {
    if (isSlot(t) && !occupied[String(t)]) return t
  }
  throw new Error('Queue calendar is full for the next 120 days')
}

export function canPublish(item: { status?: string; scheduled_at?: number; reviewed_at?: number; caption?: string }, now: number, paused: boolean) {
  return !paused && item.status === 'scheduled' && Boolean(item.reviewed_at && item.caption) &&
    isSlot(item.scheduled_at!) && item.scheduled_at! <= now && now - item.scheduled_at! < SLOT_GRACE_MS
}

export function safeArticleLink(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value !== 'string' || value.length > 1000) throw new Error('Invalid article link')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'citybeatmag.co' || !/^\/(en|es)\/stories\/[a-z0-9-]+\/?$/.test(url.pathname)) {
    throw new Error('Use a CityBeat story link beginning https://citybeatmag.co/en/stories/ or /es/stories/')
  }
  url.search = ''; url.hash = ''
  return url.toString()
}
