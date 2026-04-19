# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CityBeat** is a bilingual (EN/ES) local news magazine covering El Paso County, with a news brief automation pipeline, advertiser portal, and content management system. The project uses a monorepo structure with Turbo for orchestration.

## Architecture

### High-Level Structure

```text
├── apps/
│   ├── web/              # Main public site (Next.js, next-intl for i18n)
│   └── ads/              # Advertiser self-serve portal (Next.js + Stripe)
├── packages/
│   ├── lib/              # Shared utilities (i18n, geo, tracking)
│   └── ui/               # Shared UI components (shadcn/tailwind)
├── services/
│   └── worker/           # Cloudflare Worker (brief automation, Stripe webhooks, tracking)
├── sanity/               # Sanity CMS studio
└── infra/
    ├── config/           # sources.json, ad_slot_defs.json
    └── sql/              # Supabase migrations
```

### Key Services & Integrations

- **Frontend**: Next.js 14 with next-intl for i18n routing
- **CMS**: Sanity 3.x (content + brief management)
- **Edge/Automation**: Cloudflare Workers + Pages (scheduled brief ingestion every 5 times/day: 07:00, 10:00, 13:00, 16:00, 19:00 America/Chihuahua)
- **Database**: Supabase Postgres (analytics, audit logs)
- **Payments**: Stripe (Newsletter, Sponsored Posts, Category Banners)
- **Email**: Resend (editor notifications, billing emails)
- **Translation**: DeepL API (EN→ES)
- **News Source**: NewsAPI (brief ingestion)

### Brief Automation Pipeline

The core automation (services/worker) runs on a cron schedule and performs:

1. Fetch articles from NewsAPI (keywords: El Paso, Ciudad Juárez, border news, New Mexico, Las Cruces)
2. Categorize articles (business, events, culture, news)
3. Translate English → Spanish via DeepL
4. Save as draft to Sanity
5. Send email notification to editors
6. Log event to Supabase

**Key handlers**:

- `handlers/automation.ts` — Brief ingestion orchestration
- `handlers/stripe.ts` — Payment webhook processing
- `handlers/emails.ts` — Email template rendering
- `handlers/tracking.ts` — Client-side event logging

## Common Development Commands

### Root (Turbo orchestration)

```bash
# Install dependencies
npm install

# Develop all apps in parallel
npm run dev

# Build all apps for production
npm run build

# Start production apps
npm run start

# Lint all apps
npm run lint

# Type-check all apps
npm run type-check
```

### Web App (apps/web)

```bash
cd apps/web

# Development
npm run dev              # Runs on port 3000

# Single test (replace with actual test path)
npm run test -- src/path/to/test.spec.ts

# Type checking
npm run type-check

# Linting
npm run lint
```

### Ads Portal (apps/ads)

```bash
cd apps/ads

# Development
npm run dev              # Runs on port 3001

# Type checking
npm run type-check

# Linting
npm run lint
```

### Cloudflare Worker (services/worker)

```bash
cd services/worker

# Development
npm run dev              # Runs on http://localhost:8787

# Deploy to production
npm run deploy

# Type checking
npm run type-check
```

### Sanity Studio

```bash
cd sanity

# Development
npm run dev

# Build
npm run build

# Deploy to production
npm run deploy
```

### Shared Packages

```bash
cd packages/lib

# Type check only (no separate build step)
npm run type-check
```

## Testing & Verification

### Manual Automation Test

```bash
# Terminal 1: Start worker
cd services/worker
npm run dev

# Terminal 2: Trigger test endpoint
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification Checklist

Before deployment, verify the automation pipeline end-to-end:

1. **Sanity**: New briefs visible in studio (drafts)
2. **Supabase**: Event logs recorded
3. **Email**: Editor notifications sent
4. **Cloudflare Logs**: Execution logged without errors

See `END_TO_END_TESTING_GUIDE.md` for detailed procedures.

## Environment Variables

### Worker Secrets (services/worker/.env.production)

```text
SANITY_PROJECT_ID
SANITY_DATASET (set to "production")
SANITY_WRITE_TOKEN
STRIPE_SECRET_KEY (live key)
STRIPE_WEBHOOK_SECRET
DEEPL_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
NEWS_API_KEY
```

### Web App (apps/web/.env.local)

```text
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
SANITY_API_TOKEN
SANITY_EDITOR_TOKEN   # Required for embedded /studio route — set in Vercel env vars, never commit the real value
```

### Ads Portal (apps/ads/.env.local)

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
```

See `PRE_DEPLOYMENT_CHECKLIST.md` for complete environment setup.

## Key Development Patterns

### i18n Routing (Web & Ads)

Both Next.js apps use next-intl for language routing:

- Routes: `/en/*`, `/es/*`
- Message files: `src/messages/{en,es}.json`
- Locale context passed through `[locale]` dynamic segment

See `packages/lib/i18n/index.ts` for shared utilities.

### Shared Lib Exports

The `@citybeat/lib` package exports multiple entry points:

```typescript
import { /* i18n utils */ } from '@citybeat/lib/i18n'
import { /* geo utilities */ } from '@citybeat/lib/geo'
import { /* tracking */ } from '@citybeat/lib/tracking'
```

### Sanity Integration

- Web app uses `@sanity/client` for fetching published content
- Worker uses Sanity write token for automation
- Drafts created by automation are reviewed by editors before publishing

### Stripe Integration

- Advertiser portal uses `@stripe/react-stripe-js` for checkout
- Worker webhook processes payment events
- Prices can be pre-configured via env vars or fetched dynamically from Stripe

## Deployment

### Pre-Deployment Checklist

1. Verify all environment variables set (see `PRE_DEPLOYMENT_CHECKLIST.md`)
2. Run `npm run build && npm run type-check` to ensure clean build
3. Test automation pipeline in staging
4. Review brief content in Sanity before first production run

### Production Deployment

- **Web** (`city-beat-mag`): Deployed to Vercel — push to `main` triggers auto-deploy at [citybeatmag.co](https://citybeatmag.co)
- **Ads** (`city-beat-ads`): Deployed to Vercel — push to `main` triggers auto-deploy at [city-beat-ads.vercel.app](https://city-beat-ads.vercel.app)
- **Worker**: `cd services/worker && npm run deploy`
- **Sanity Studio**: `cd sanity && npm run deploy`

## Debugging Tips

### Worker Logs

Monitor execution via Cloudflare Dashboard:

1. Go to <https://dash.cloudflare.com/>
2. Navigate to Workers → citybeat-worker → Logs tab
3. Filter by timestamp to find recent runs

### Sanity Studio (/studio)

The studio is embedded in the web app via `next-sanity/studio` at `apps/web/src/app/studio/[[...index]]/page.tsx`.

- `apps/web/next.config.js` excludes `/studio` from the `X-Frame-Options` header — Sanity Studio uses iframes internally and requires this
- CORS for `https://citybeatmag.co` is managed automatically via Sanity's hosted studio integration
- `SANITY_EDITOR_TOKEN` must be set in Vercel environment variables (Production) for the studio to authenticate

### Sanity API Issues

Check Sanity token validity and dataset permissions:

```bash
curl -H "Authorization: Bearer $SANITY_WRITE_TOKEN" \
  https://api.sanity.io/v2021-06-07/projects/$SANITY_PROJECT_ID/datasets/$SANITY_DATASET
```

### DeepL Translation Quota

Monitor usage in DeepL dashboard to avoid hitting API limits during automation.

## Additional Resources

- `Initialization.md` — Project setup and requirements
- `AUTOMATION_SCHEDULE_GUIDE.md` — Cron schedule details
- `STRIPE_SETUP_GUIDE.md` — Payment configuration
- `CLOUDFLARE_SETUP_GUIDE.md` — Edge & DNS setup
- `END_TO_END_TESTING_GUIDE.md` — Full pipeline testing
