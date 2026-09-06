import Stripe from 'stripe'

const STRIPE_TIMEOUT_MS = 3000

// The Stripe key is checked at most this often. The uptime check runs every 5
// minutes across an unknown number of instances, and this is an authentication
// probe, not a liveness one — a dead key does not heal on its own, so there is
// nothing to gain from asking more often.
const STRIPE_CHECK_INTERVAL_MS = 5 * 60 * 1000
let stripeCache: { at: number; ok: boolean; error: string | null } = { at: 0, ok: true, error: null }

// WHY STRIPE IS CHECKED HERE AT ALL:
// the live secret key silently stopped working — Stripe answered every call with
// "Expired API Key provided", which is what it says about a key that has been
// rolled. The site kept serving perfectly: news, directory, search, sign-in, the
// health check itself all green. What it could not do was take a single payment,
// because EVERY Stripe call fails on an authentication error — create a checkout
// session, open the billing portal, retrieve a subscription, pay a rep. It was
// two days before anything noticed, and only because a reconciliation cron that
// happened to call Stripe was returning 500s.
//
// "Cannot take money" is the most severe state this business has, and nothing was
// watching for it. It is reported here for visibility, but it does NOT fail this
// probe — /api/health answers "is the site up", which is a different question with
// a different urgency, and is also the deploy pipeline's smoke test. Conflating
// them would block every deploy while payments are down, including the deploy that
// fixes them. The failing probe lives at /api/health/payments.
//
// Deliberately narrow — only an AUTHENTICATION failure (a bad, rolled, or wrong-
// mode key) counts as unhealthy. A Stripe outage or a network blip is not our
// configuration being broken, and must not flap the whole health check.
function isStripeAuthFailure(error: any): boolean {
  if (error?.type === 'StripeAuthenticationError') return true
  if (error?.statusCode === 401) return true
  return /expired api key|invalid api key|no api key provided/i.test(String(error?.message || ''))
}

export async function checkStripe(): Promise<{ ok: boolean; error: string | null; checked: boolean }> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { ok: true, error: null, checked: false } // not configured is not "broken"

  const now = Date.now()
  if (now - stripeCache.at < STRIPE_CHECK_INTERVAL_MS) {
    return { ok: stripeCache.ok, error: stripeCache.error, checked: false }
  }

  const stripe = new Stripe(key, {
    apiVersion: '2023-10-16' as any,
    timeout: STRIPE_TIMEOUT_MS,
    maxNetworkRetries: 0,
  })
  try {
    // The cheapest authenticated call there is: one balance read, no side effects.
    await stripe.balance.retrieve()
    stripeCache = { at: now, ok: true, error: null }
  } catch (error: any) {
    if (isStripeAuthFailure(error)) {
      stripeCache = { at: now, ok: false, error: `auth:${String(error?.message || 'rejected').slice(0, 120)}` }
    } else {
      // Reachability problem, not a configuration one. Report it without
      // failing the probe, and do not cache it as a verdict on the key.
      return { ok: true, error: `unreachable:${String(error?.message || 'error').slice(0, 80)}`, checked: true }
    }
  }
  return { ok: stripeCache.ok, error: stripeCache.error, checked: true }
}

