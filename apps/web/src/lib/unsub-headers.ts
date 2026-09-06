import { mintUnsubToken, normalizeNewsletterEmail } from './newsletter'

// RFC 8058 one-click unsubscribe headers.
//
// A visible footer link is not enough. Gmail and Yahoo's bulk-sender rules
// require List-Unsubscribe plus List-Unsubscribe-Post, honoured within two days,
// and mailbox providers use the header to offer their OWN unsubscribe button —
// the one most people actually press. Without it, the alternative a recipient
// reaches for is "report spam", which is what damages sending reputation for
// every stream at once, including the transactional mail that tells a paying
// customer their listing went live.
//
// Shared because the header has to be identical everywhere: a provider that sees
// the header on one campaign and not the next treats the sender as inconsistent.
// It was originally written inline for the checkout-recovery cron alone.
//
// Deliberately keyed on the EMAIL, not on a per-send outreach id, so a one-click
// unsubscribe suppresses the address globally rather than silencing one campaign
// while the others keep arriving. The token is an HMAC that reveals only a hash,
// so the header cannot be used to enumerate addresses.

const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export function unsubHeaders(email: string, locale?: unknown): Record<string, string> {
  const normalized = normalizeNewsletterEmail(email)
  if (!normalized) return {}
  const token = mintUnsubToken(normalized)
  const url = `${APP_ORIGIN}/api/newsletter/unsubscribe?u=${encodeURIComponent(token)}${
    locale === 'es' ? '&l=es' : ''
  }`
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
