import { Router } from 'itty-router'
import { handleBriefAutomation } from './handlers/automation'
import { handleTracking } from './handlers/tracking'
import { handleTranslate } from './handlers/translate'

export interface Env {
  INGEST_URL: string
  INGEST_SECRET: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  DEEPL_API_KEY: string
  RESEND_API_KEY: string
  NEWS_API_KEY: string
}

const router = Router()

// Health check
router.get('/health', () => new Response('OK'))

// Stripe webhooks are handled by the web app (Firestore-backed):
//   https://citybeatmag.co/api/stripe/webhook

// Tracking
router.post('/api/tracking', async (request, env: Env) => {
  return handleTracking(request, env)
})

// Translation (DeepL) — used by the web app to translate article content to ES.
router.post('/api/translate', async (request, env: Env) => {
  return handleTranslate(request, env)
})

// Test automation endpoint (for manual triggering in development)
router.post('/api/test-automation', async (_request, env: Env) => {
  try {
    console.log('Manual automation test triggered')
    await handleBriefAutomation(env)
    return new Response(JSON.stringify({ status: 'ok', message: 'Automation completed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Automation test failed:', error)
    return new Response(JSON.stringify({ status: 'error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// Catch-all 404 (itty-router v5 returns undefined for unmatched routes).
router.all('*', () => new Response('Not found', { status: 404 }))

// Scheduled event handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // itty-router v5 exposes `.fetch` (the old `.handle` was removed).
    return router.fetch(request, env, ctx)
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run brief automation every scheduled time
    ctx.waitUntil(handleBriefAutomation(env))
  },
}
