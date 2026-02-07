import { Router } from 'itty-router'
import { handleBriefAutomation } from './handlers/automation'
import { handleStripeWebhook } from './handlers/stripe'
import { handleTracking } from './handlers/tracking'

export interface Env {
  SANITY_PROJECT_ID: string
  SANITY_DATASET: string
  SANITY_WRITE_TOKEN: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  DEEPL_API_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_URL: string
  RESEND_API_KEY: string
  NEWS_API_KEY: string
}

const router = Router()

// Health check
router.get('/health', () => new Response('OK'))

// Stripe webhook
router.post('/webhooks/stripe', async (request, env: Env) => {
  return handleStripeWebhook(request, env)
})

// Tracking
router.post('/api/tracking', async (request, env: Env) => {
  return handleTracking(request, env)
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

// Scheduled event handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx)
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run brief automation every scheduled time
    ctx.waitUntil(handleBriefAutomation(env))
  },
}
