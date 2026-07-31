// Newsletter consent, suppression, and a secure unsubscribe token. Pure +
// tested. The key privacy rules from the platform brief:
//  - Unsubscribe links must NOT reveal the email (no email in the URL).
//  - An existing unsubscribe is a permanent suppression — never reactivated
//    except by a deliberate resubscribe.
//  - Promotional consent is recorded separately from transactional messaging.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeSalesEmail } from './sales-checkout'

export const NEWSLETTER_POLICY_VERSION = '2026-07'

export type NewsletterStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained'

export function normalizeNewsletterEmail(email: unknown): string {
  return normalizeSalesEmail(typeof email === 'string' ? email : '')
}

// Opaque, deterministic id for an email — used as the suppression doc id and the
// lookup key on subscriber docs, so we can act on an email without ever storing
// or transmitting it in the clear in a link.
export function emailHash(emailNormalized: string): string {
  return createHash('sha256').update(`citybeat-newsletter:${emailNormalized}`).digest('hex')
}

const UNSUB_SECRET =
  process.env.UNSUB_TOKEN_SECRET || process.env.CRON_SECRET || 'citybeat-newsletter-unsub'

// Signed, opaque token = <emailHash>.<hmac>. Reveals only the hash (never the
// email), and can't be forged/enumerated without the secret.
export function mintUnsubToken(emailNormalized: string): string {
  const eid = emailHash(emailNormalized)
  const sig = createHmac('sha256', UNSUB_SECRET).update(eid).digest('hex').slice(0, 32)
  return `${eid}.${sig}`
}

// Returns the verified emailHash, or null if the token is malformed/forged.
export function verifyUnsubToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const [eid, sig] = token.split('.')
  if (!eid || !sig || !/^[a-f0-9]{64}$/.test(eid) || !/^[a-f0-9]{32}$/.test(sig)) return null
  const expected = createHmac('sha256', UNSUB_SECRET).update(eid).digest('hex').slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b) ? eid : null
}

export function isSuppressedStatus(status: unknown): boolean {
  return status === 'unsubscribed' || status === 'complained' || status === 'bounced'
}

export type SubscriberRecord = {
  email_normalized: string
  email_display: string
  email_hash: string
  status: NewsletterStatus
  newsletter_opt_in: boolean
  consent_timestamp: string
  consent_source: string
  consent_policy_version: string
  consent_locale: 'en' | 'es'
  consent_method: string
  user_id: string | null
  listing_ids: string[]
  created_at: string
  updated_at: string
}

export function buildSubscriberRecord(input: {
  email: string
  locale?: string
  source?: string
  method?: string
  userId?: string | null
  listingIds?: string[]
  now: string
}): SubscriberRecord {
  const email_normalized = normalizeNewsletterEmail(input.email)
  const locale: 'en' | 'es' = input.locale === 'es' ? 'es' : 'en'
  return {
    email_normalized,
    email_display: typeof input.email === 'string' ? input.email.trim().slice(0, 200) : email_normalized,
    email_hash: emailHash(email_normalized),
    status: 'active',
    newsletter_opt_in: true,
    consent_timestamp: input.now,
    consent_source: (input.source || 'newsletter').slice(0, 60),
    consent_policy_version: NEWSLETTER_POLICY_VERSION,
    consent_locale: locale,
    consent_method: (input.method || 'web_form').slice(0, 40),
    user_id: input.userId || null,
    listing_ids: Array.isArray(input.listingIds) ? input.listingIds.slice(0, 50) : [],
    created_at: input.now,
    updated_at: input.now,
  }
}

// US CAN-SPAM is opt-out (checkbox may be preselected); jurisdictions requiring
// affirmative opt-in must start unchecked. Default US → preselected true.
export function newsletterDefaultChecked(policy?: string): boolean {
  return policy !== 'affirmative_opt_in'
}
