# Cloudflare Worker Setup Guide

This guide explains how to set up and configure the CityBeat Cloudflare Worker for automation, webhooks, and scheduled tasks.

## Overview

The worker handles:
- **Scheduled Brief Automation**: Fetches news from APIs, translates content, and publishes to Sanity
- **Stripe Webhooks**: Processes payment and subscription events
- **Analytics Tracking**: Records ad impressions and clicks
- **Email Notifications**: Sends alerts to editors about new briefs
- **Daily/Weekly Reports**: Generates analytics summaries

## Environment Variables

### Required Variables

Create a `.env.local` file or set these in Cloudflare Dashboard:

```
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=development
SANITY_WRITE_TOKEN=your_write_token
DEEPL_API_KEY=your_deepl_api_key
NEWS_API_KEY=your_newsapi_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
RESEND_API_KEY=your_resend_api_key
```

### Getting API Keys

**NewsAPI**
- Visit: https://newsapi.org
- Sign up for a free account
- Copy your API key from the dashboard

**DeepL API**
- Visit: https://www.deepl.com/pro-api
- Sign up for a free plan (500,000 characters/month)
- Copy your authentication key

**Stripe**
- Dashboard: https://dashboard.stripe.com
- API Keys section: https://dashboard.stripe.com/apikeys
- Copy Secret Key (starts with `sk_test_` or `sk_live_`)
- Webhook signing secret from: https://dashboard.stripe.com/webhooks

**Supabase**
- Project Settings: https://app.supabase.com/project/[project-id]/settings/api
- Service Role Key is in the API section
- URL is displayed at the top of API section

**Resend**
- Tokens: https://resend.com/api-keys
- Create new API key and copy it

## Local Development

### Start the Worker

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

### Test Endpoints

**Health Check**
```bash
curl http://localhost:8787/health
```

**Manual Automation Trigger**
```bash
curl -X POST http://localhost:8787/api/test-automation
```

**Track an Event**
```bash
curl -X POST http://localhost:8787/api/tracking \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "campaign-123",
    "eventType": "impression",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

## Scheduled Jobs

The worker runs automated brief fetching at these times (CST):
- 7:00 AM - Morning Brief
- 10:00 AM - Mid-Morning Brief
- 1:00 PM - Noon Brief
- 4:00 PM - Afternoon Brief
- 7:00 PM - Evening Brief

### Adding More Cron Jobs

Edit `wrangler.toml`:
```toml
[[triggers.crons]]
cron = "0 23 * * *"  # 11 PM daily
```

Then update `src/index.ts` to handle additional schedules:
```typescript
async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const hour = new Date().getUTCHours()

  if (hour === 7 || hour === 10 || hour === 13 || hour === 16 || hour === 19) {
    // Run brief automation
    ctx.waitUntil(handleBriefAutomation(env))
  } else if (hour === 23) {
    // Run daily analytics
    ctx.waitUntil(handleDailyAnalyticsReport(env))
  }
}
```

## API Endpoints

### POST /api/tracking
Track ad impressions and clicks.

**Request:**
```json
{
  "campaignId": "campaign-123",
  "eventType": "click",
  "userIp": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "referer": "https://example.com",
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "summer-sale"
}
```

**Response:**
```json
{
  "status": "ok",
  "trackingId": "tracking-uuid"
}
```

### POST /webhooks/stripe
Receives Stripe webhook events.

**Handled Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.succeeded`
- `charge.failed`

**Example Setup:**
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://api.citybeatmag.co/webhooks/stripe`
3. Select events: subscription and charge events
4. Copy signing secret and add to environment variables

### POST /api/test-automation
Manually trigger the brief automation (development only).

## Handlers Overview

### automation.ts
- Fetches briefs from NewsAPI and RSS feeds
- Automatically translates content to Spanish using DeepL
- Creates draft briefs in Sanity CMS
- Sends notifications to editors via email

### stripe.ts
- Validates Stripe webhook signatures
- Updates subscription status in Supabase
- Processes charge events
- Sends payment confirmations

### tracking.ts
- Records ad impressions and clicks
- Stores analytics data in Supabase
- Calculates daily metrics

### emails.ts
- Sends HTML email templates
- Integrates with Resend API
- Handles editor notifications
- Sends payment receipts

### analytics.ts
- Generates daily analytics reports
- Calculates weekly metrics
- Sends report emails to stakeholders

## Deployment

### To Production

```bash
npm run deploy
```

This will:
1. Build the worker
2. Deploy to Cloudflare Workers
3. Set production environment variables
4. Update cron schedules

### Configure Production Variables

In Cloudflare Dashboard:
1. Navigate to your worker
2. Settings → Variables
3. Add production environment variables
4. Set to use production Sanity dataset and API keys

## Monitoring

### View Worker Logs

```bash
npx wrangler tail
```

### View in Cloudflare Dashboard

1. Workers → Select `citybeat-worker`
2. Logs tab shows recent executions
3. Metrics tab shows invocation stats

## Troubleshooting

### Briefs not being created
1. Check that `SANITY_WRITE_TOKEN` is set correctly
2. Verify Sanity project ID and dataset name
3. Check worker logs: `npx wrangler tail`
4. Manually trigger: `curl -X POST http://localhost:8787/api/test-automation`

### Emails not sending
1. Verify `RESEND_API_KEY` is correct
2. Check that recipient email is verified in Resend
3. Look for rate limiting (100 emails/day on free plan)
4. Check worker logs for email send errors

### Translation failures
1. Verify `DEEPL_API_KEY` is set correctly
2. Check character count usage: https://www.deepl.com/usage
3. Ensure content is not empty before translation

### Stripe webhooks not working
1. Verify webhook URL in Stripe dashboard
2. Check signing secret matches `STRIPE_WEBHOOK_SECRET`
3. Ensure worker is deployed to production domain
4. Test with Stripe CLI locally

## Next Steps

- [ ] Set up production Sanity project
- [ ] Configure production Supabase database
- [ ] Create Stripe account and configure webhooks
- [ ] Set up Resend email domain verification
- [ ] Deploy worker to production
- [ ] Monitor and optimize performance
- [ ] Set up alerting for failures

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Sanity API Documentation](https://www.sanity.io/docs/http-api)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [DeepL API](https://www.deepl.com/docs-api/)
- [Resend Email API](https://resend.com/docs)
