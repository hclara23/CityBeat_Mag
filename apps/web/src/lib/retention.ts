// Retention for the collections that grow forever.
//
// Firestore had ZERO TTL policies. `ai_audit` was the only collection that even
// stamped an expiry, and the policy that would act on it had never been enabled,
// so nothing was ever deleted anywhere. Every page view, every rate-limit
// counter, every concierge conversation and every Stripe event id accumulated
// permanently — storage that only goes up, and collections that get more
// expensive to scan the longer the site runs.
//
// A Firestore TTL policy deletes ONLY documents that carry the field, set to a
// time in the past. Enabling one therefore cannot retroactively erase history:
// documents written before these stamps existed have no `expires_at` and are
// left alone forever. Retention starts from the day this ships.
//
// Enable a policy with:
//   gcloud firestore fields ttls update expires_at \
//     --collection-group=<name> --enable-ttl --project=kerstenblueprint

/** Page views. The analytics dashboard looks back 30 days; a year and a bit
 *  leaves room for a year-over-year view without unbounded growth. */
export const ANALYTICS_RETENTION_DAYS = 400

/** Concierge conversations. Useful as product signal for a season, not forever. */
export const CHAT_RETENTION_DAYS = 180

/** Stripe event ids, our webhook idempotency ledger. Retention must comfortably
 *  exceed Stripe's own retry window (3 days) and the reconciliation cron's
 *  lookback (30 days); a year is far past any point where re-processing an event
 *  could still be correct. */
export const STRIPE_EVENT_RETENTION_DAYS = 400

/** Rate-limit counters. Keys include the caller's IP, so the document count
 *  grows with unique visitors and nothing ever removed them — only a successful
 *  login clears its own key. These are dead the moment their window closes; the
 *  extra day is slack for clock skew and for reading a retryAfter. */
export const RATE_LIMIT_GRACE_MS = 24 * 60 * 60 * 1000

export function expiresInDays(days: number, now: number = Date.now()): Date {
  return new Date(now + days * 86400000)
}
