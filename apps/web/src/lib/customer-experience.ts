/** Localized internal return URLs; never accept external or ambiguous paths. */
export function localizedReturnPath(locale: string, destination: string | null, fallback = '/dashboard') {
  const safe = destination && /^\/(?!\/)/.test(destination) && !/[\\\u0000-\u0020]/.test(destination)
    && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(destination) ? destination : fallback
  return `/${locale === 'es' ? 'es' : 'en'}${safe.replace(/^(?:\/(?:en|es))+(?=\/|\?|#|$)/, '') || '/'}`
}

export function cleanListingText(value: string | null | undefined) {
  return (value || '').replace(/[\uE000-\uF8FF]/g, '').trim()
}

export function formatEventTime(value: string, locale: string, timeZone = 'America/Denver') {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  let zone = timeZone
  try { new Intl.DateTimeFormat('en', { timeZone: zone }) } catch { zone = 'America/Denver' }
  return date.toLocaleString(locale === 'es' ? 'es-MX' : 'en-US', {
    timeZone: zone, timeZoneName: 'short', weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}
