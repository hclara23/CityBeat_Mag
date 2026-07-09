// Ticketmaster affiliate link wrapping. CityBeat already shows real Ticketmaster
// events with "buy tickets" links — tagging those with an affiliate ID earns a
// commission on every ticket sold through the site. Dormant until configured.
//
// Ticketmaster's affiliate program (via Impact.com) gives you ONE of two formats:
//
//   1. A redirect/deep-link wrapper. Set TICKETMASTER_AFFILIATE_WRAP to the
//      template with a literal {url} placeholder, e.g.
//        https://ticketmaster.evyy.net/c/PUBID/CAMPID/APIID?u={url}
//      We substitute the URL-encoded destination for {url}.
//
//   2. Tracking query params to append to the Ticketmaster URL. Set
//      TICKETMASTER_AFFILIATE_PARAMS to those params, e.g.
//        irgwc=1&clickid=... (Impact) or the legacy camefrom=CFC_...
//
// Only Ticketmaster-family hosts are tagged, so community-submitted event links
// are never rewritten.

const TM_HOSTS = /(ticketmaster\.|ticketm\.net|livenation\.|ticketweb\.|universe\.com)/i

export function affiliateTicketUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return url ?? null
  if (!TM_HOSTS.test(url)) return url

  const wrap = process.env.TICKETMASTER_AFFILIATE_WRAP
  if (wrap && wrap.includes('{url}')) {
    return wrap.replace('{url}', encodeURIComponent(url))
  }

  const params = process.env.TICKETMASTER_AFFILIATE_PARAMS
  if (params) {
    const clean = params.replace(/^[?&]+/, '')
    return `${url}${url.includes('?') ? '&' : '?'}${clean}`
  }

  return url
}

// True when an affiliate program is actually configured (for diagnostics).
export function affiliateConfigured(): boolean {
  return Boolean(process.env.TICKETMASTER_AFFILIATE_WRAP || process.env.TICKETMASTER_AFFILIATE_PARAMS)
}
