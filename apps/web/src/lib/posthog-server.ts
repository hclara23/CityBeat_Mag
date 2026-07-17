import { PostHog } from 'posthog-node'

// Server-side PostHog for capturing backend events (conversions, payouts, cron
// outcomes) tied to a user/distinct id. Dormant + never throws until POSTHOG_KEY
// (or NEXT_PUBLIC_POSTHOG_KEY) is set on the server.

let cached: PostHog | null | undefined

function getClient(): PostHog | null {
  if (cached !== undefined) return cached
  const key = process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    cached = null
    return cached
  }
  try {
    cached = new PostHog(key, {
      host: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })
  } catch {
    cached = null
  }
  return cached
}

export async function captureServer(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const c = getClient()
  if (!c || !distinctId) return
  try {
    c.capture({ distinctId, event, properties })
    await c.flush()
  } catch {
    /* analytics must never break the app */
  }
}
