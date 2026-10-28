import { adminDb } from '@citybeat/lib/firebase/admin'
import { CLAIM_FUNNEL_RETENTION_DAYS, expiresInDays } from './retention'

// Where does the self-serve claim flow stall?
//
// Self-serve claims have been ZERO since launch (October 2026: 361 businesses
// emailed, 20 clicked, 0 claimed) and the flow gave no way to say why. Most of
// the path already leaves a trace: a verified claim is a `directory_claims` row,
// an approved one flips the listing, a payment is a webhook event. But three
// moments leave NOTHING, and they are exactly the ones a stalled owner hits:
//
//   view              the claim page rendered, and whether the visitor was signed
//                     in. A signed-out visitor is stopped at "create an account
//                     first"; page views alone cannot tell that wall from a bounce.
//   code_requested    asked for a verification code, and what happened. Every
//                     failure here used to vanish: a refused request, no email or
//                     phone on record, text verification switched off (no Twilio),
//                     a send that failed (the claim row is deleted on failure).
//   checkout_started  a Stripe Checkout session was created for a claim.
//
// Events are best-effort and carry ids only: never an address, name or code.

export type ClaimFunnelStep = 'view' | 'code_requested' | 'checkout_started'

export const CLAIM_FUNNEL_STEPS: readonly ClaimFunnelStep[] = ['view', 'code_requested', 'checkout_started']

export interface ClaimFunnelEvent {
  step: ClaimFunnelStep
  listing_id: string
  /** code_requested: sent | rate_limited | bad_method | unavailable | sms_not_enabled | sms_failed | email_failed | error */
  outcome?: string
  user_id?: string | null
  /** view only. Decided on the server from the session, never taken from the client. */
  signed_in?: boolean
  locale?: string | null
  method?: string | null
  plan?: string | null
}

const COLLECTION = 'claim_funnel_events'

/** Never throws: instrumentation must not be able to fail a claim. */
export async function recordClaimEvent(e: ClaimFunnelEvent): Promise<void> {
  try {
    await adminDb.collection(COLLECTION).add({
      step: e.step,
      listing_id: e.listing_id,
      outcome: e.outcome ?? null,
      user_id: e.user_id ?? null,
      signed_in: e.signed_in ?? null,
      locale: e.locale ?? null,
      method: e.method ?? null,
      plan: e.plan ?? null,
      created_at: new Date().toISOString(),
      // Dropped by the Firestore TTL policy on this field (firestore.indexes.json).
      expires_at: expiresInDays(CLAIM_FUNNEL_RETENTION_DAYS),
    })
  } catch {
    /* a lost event is a gap in a chart, never a failed claim */
  }
}

export interface ClaimFunnelRow {
  step?: unknown
  listing_id?: unknown
  outcome?: unknown
  signed_in?: unknown
}

export interface ClaimFunnelSummary {
  views: number
  view_listings: number
  views_signed_out: number
  code_requests: number
  codes_sent: number
  /** outcome -> count, for every code request that did not send */
  code_failures: Record<string, number>
  checkouts: number
}

/** Pure: collapse a window of events into the numbers the weekly digest prints. */
export function summarizeClaimFunnel(rows: readonly ClaimFunnelRow[]): ClaimFunnelSummary {
  const s: ClaimFunnelSummary = {
    views: 0, view_listings: 0, views_signed_out: 0, code_requests: 0, codes_sent: 0, code_failures: {}, checkouts: 0,
  }
  const viewed = new Set<string>()
  for (const r of rows) {
    if (r.step === 'view') {
      s.views++
      if (r.signed_in === false) s.views_signed_out++
      if (typeof r.listing_id === 'string') viewed.add(r.listing_id)
    } else if (r.step === 'code_requested') {
      s.code_requests++
      if (r.outcome === 'sent') s.codes_sent++
      else {
        const k = typeof r.outcome === 'string' && r.outcome ? r.outcome : 'unknown'
        s.code_failures[k] = (s.code_failures[k] || 0) + 1
      }
    } else if (r.step === 'checkout_started') {
      s.checkouts++
    }
  }
  s.view_listings = viewed.size
  return s
}

/** One line, plain English, for the digest. */
export function describeClaimFunnel(s: ClaimFunnelSummary): string {
  if (!s.views && !s.code_requests && !s.checkouts) return 'no claim activity recorded'
  const failures = Object.entries(s.code_failures)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`)
    .join(', ')
  return (
    `${s.views} claim page views (${s.view_listings} businesses, ${s.views_signed_out} signed out) → ` +
    `${s.code_requests} code requests (${s.codes_sent} sent${failures ? `; not sent: ${failures}` : ''}) → ` +
    `${s.checkouts} checkout${s.checkouts === 1 ? '' : 's'} started`
  )
}
