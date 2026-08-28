# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CityBeat** is a bilingual (EN/ES) local news magazine covering El Paso County, with a news brief automation pipeline, advertising & business-directory monetization, and content management — all in one Next.js app. The project uses a monorepo structure with Turbo for orchestration.

## Architecture

### High-Level Structure

```text
├── apps/
│   └── web/              # Main public site incl. advertising, directory, admin, sales (Next.js, next-intl)
├── packages/
│   ├── lib/              # Shared utilities (i18n, geo, tracking)
│   └── ui/               # Shared UI components (shadcn/tailwind)
├── services/
│   └── worker/           # Cloudflare Worker (brief automation, Stripe webhooks, tracking)
└── infra/
    └── config/           # sources.json, ad_slot_defs.json
```

> **Removed architecture (June 2026):** Sanity CMS, the embedded `/studio`
> route, and the worker's DeepL/Stripe roles are GONE from this codebase.
> Firestore is the sole content store; the web app's `/api/stripe/webhook` is
> the only payment processor; translation runs through `lib/translate.ts`
> (DeepL-via-worker HTTP endpoint, falling back to Claude). If an instruction
> below still references Sanity, it is stale — do not provision Sanity
> credentials or deploy a studio.

### Key Services & Integrations

- **Frontend**: Next.js 14 with next-intl for i18n routing
- **Content storage**: Firestore `articles` collection (Sanity CMS was fully removed in June 2026 — see note below)
- **Edge/Automation**: Cloudflare Workers + Pages (scheduled brief ingestion every 5 times/day: 07:00, 10:00, 13:00, 16:00, 19:00 America/Chihuahua)
- **Database**: Firebase Firestore (content, directory, payments, analytics, audit logs)
- **Payments**: Stripe (Newsletter, Sponsored Posts, Category Banners)
- **Email**: Resend (editor notifications, billing emails)
- **Translation**: DeepL API (EN→ES)
- **News Source**: NewsAPI (brief ingestion)

### Brief Automation Pipeline

The core automation (services/worker) runs on a cron schedule and performs:

1. Fetch articles from NewsAPI (keywords: El Paso, Ciudad Juárez, border news, New Mexico, Las Cruces)
2. Categorize articles (business, events, culture, news)
3. POST each to the web app's `/api/ingest/brief` (x-ingest-secret auth), which
   dedupes via `processed_news` and stores a `pending_review` article in
   Firestore for the /admin review queue (NO Sanity, NO DeepL in this path —
   translation happens in the web app at publish time)
4. Send email notification to editors (HTML-escaped; only for briefs that saved)

**Key handlers**:

- `handlers/automation.ts` — Brief ingestion orchestration
- `handlers/emails.ts` — Email template rendering
- `handlers/tracking.ts` — Client-side event logging

### Growth automation (Cloud Scheduler)

Separate from the brief worker, the **web app** exposes cron endpoints (GET,
`Authorization: Bearer ${CRON_SECRET}`) that run the growth/sales engine. They are
triggered by **Google Cloud Scheduler** jobs (project `kerstenblueprint`, region
`us-central1`, tz America/Chihuahua) — NOT Vercel Cron (removed in the migration):

| Job | Schedule | Endpoint | Does |
|---|---|---|---|
| `citybeat-referrals` | 00:30 | `/api/cron/referrals` | qualifies paid directory referrals after three calendar months, enforces the 16/year cap, credits reward balances, and synchronizes the next Stripe discount; dry-run with `?dryRun=1` |
| `citybeat-directory-ingest` | 02:00 | `/api/cron/directory-ingest` | crawl/seed local businesses (sales inventory) — 10 verticals, El Paso + Doña Ana counties; insert-only (never touches claimed/paid listings) |
| `citybeat-enrich-contacts` | 03:00 | `/api/cron/enrich-contacts` | find emails/phones for listings |
| `citybeat-sync-events` | 04:00 | `/api/cron/sync-events` | real Ticketmaster events (`TICKETMASTER_API_KEY` set on Cloud Run 2026-07-02); never touches community/featured events |
| `citybeat-sales-agent` | 09:00 | `/api/cron/sales-agent?limit=20` | Claude-written bilingual outbound drip (A/B-tested first-touch subjects) + mid-funnel recovery (abandoned claims, basic→Premium) |
| `citybeat-newsletter-digest` | Fri 08:00 | `/api/cron/newsletter-digest` | weekly story digest to subscribers; "Sponsored by" slot from `ad_banners` placement=`newsletter`; dry-run with `?dryRun=1` |
| `citybeat-owner-reports` | monthly 1st 09:00 | `/api/cron/owner-reports` | ROI report (views/leads/reviews) emailed to every claimed-listing owner; basic tier gets Premium upsell |
| `citybeat-upsell` | Tue 10:00 | `/api/cron/upsell?limit=20` | Premium→Featured upsell emails (one per listing) |
| `citybeat-ops-digest` | Mon 08:00 | `/api/cron/ops-digest` | weekly operator heartbeat to `ALERT_EMAIL`: revenue, funnel, inventory, leads, failures |
| `citybeat-account-manager` | Wed 09:30 | `/api/cron/account-manager` | AI marketing drafts (deal, captions, review replies) per paying listing → owner approves on /dashboard; needs `ANTHROPIC_API_KEY` |
| `citybeat-social` | 11:00 | `/api/cron/social?limit=5` | auto-posts recent stories + a weekly "This Weekend in El Paso" roundup (Thu, or `?weekend=1`) to Facebook Page (`FB_PAGE_ID`/`FB_PAGE_ACCESS_TOKEN`) + Threads (`THREADS_USER_ID`/`THREADS_ACCESS_TOKEN`, dormant); IG/X stubbed. Weekly dedup only marks done on a real post |
| `citybeat-auto-articles` | 06:30/11:30/15:30/19:30 | `/api/cron/auto-articles?limit=2` | autonomous newsroom: pulls local outlet RSS (KVIA, El Paso Matters, KTSM, Herald-Post), Claude re-reports each as an original AP-style bilingual brief (`lib/newsroom.ts` `AI_WRITING_RULES`), credits source. Saves EN+ES to `articles` as `pending_review` (→ /admin review queue); `settings.newsroom_auto_publish` or `?publish=1` to auto-publish; `?dryRun=1` to preview. Deduped via `processed_news`. Needs `ANTHROPIC_API_KEY` |
| `citybeat-translate-listings` | 05:00 | `/api/cron/translate-listings?limit=40` | backfills `description_es` for directory listings that have an English description but no Spanish one; self-skips when none remain. (New/edited listings are translated on save in `/api/directory/[id]`.) |
| `citybeat-checkout-recovery` | 08:00 | `/api/cron/checkout-recovery` | **abandoned-checkout recovery.** Two passes, gated differently: it ALWAYS marks `sales_orders` whose Stripe session has lapsed as `checkout_status: 'expired'` (internal truth only — the Sales Desk was showing reps dead payment links as live), and it emails the customer a one-time nudge ONLY when explicitly enabled via `?send=1` or `CHECKOUT_RECOVERY_EMAILS=on`, so scheduling it is safe by default. One nudge per order ever, stamped only on a real send; 45-day window. `?dryRun=1` lists exactly who would be contacted. Logic + copy in `lib/checkout-recovery.ts`. |
| `citybeat-payout-cycle` | 1st & 15th 09:00 | `/api/cron/payout-cycle` | **pays commission.** Transfers every `transfers` row that is `held` and past its `eligible_at` (7 days after the sale). Commission is NOT paid at sale time — `payoutSplit` accrues it as `held`, the 7-day hold is the refund/change-of-mind window, and this cron releases it on the 1st and the 15th (America/Chihuahua). Re-checks the cycle day server-side so a stray call can't pay off-cycle; `?force=1` for a deliberate catch-up, `?dryRun=1` to preview. See `lib/commission-schedule.ts` for the schedule rules and the rep-facing policy copy. |
| `citybeat-reconcile-payouts` | 01:00 | `/api/cron/reconcile-payouts?limit=50` | completes commission transfers that didn't go through at webhook time — `transfers` rows in `failed` (funds hadn't settled / Stripe error) or `skipped_no_connected_account` (payee hadn't connected a bank yet). Idempotent: skips already-`paid` shares (ledger check + `transfer_group` backstop), retries with a per-row idempotency key so it never double-pays. Dry-run with `?dryRun=1`. Commission transfers use Stripe `source_transaction` (the charge id) so they succeed against still-pending funds; this cron is the safety net for the residual cases. |
| `citybeat-scrapeflow` | 02:30 | `/api/cron/scrapeflow?limit=3` | **ScrapeFlow** directory-growth scraper (`apps/web/src/lib/scrapeflow/`, admin UI at `/admin/scrapeflow`): a port of the open-source ScrapeFlow workflow engine (Launch browser → Get HTML/Text → Extract links → Crawl pages → Extract listings with AI (Claude) → Deliver to directory). Workflows live in Firestore `scrapeflow_workflows` (JSON node definitions, seeded from `lib/scrapeflow/templates.ts`), runs with per-phase logs in `scrapeflow_runs`. Runs up to `limit` enabled workflows whose `interval_hours` elapsed; `?dryRun=1` previews. Directory sink is **insert-only** (`sf:<hash>` ids, name+street/phone dedupe, El Paso/Doña Ana region filter). Browser backend: plain fetch → Crawl4AI when `CRAWLER_URL` set → Puppeteer locally (`SCRAPEFLOW_BROWSER=puppeteer`). Needs `ANTHROPIC_API_KEY`. Non-browser entry nodes: `FETCH_JSON` + `MAP_JSON_TO_LISTINGS` (open data, e.g. TDLR electrician licenses `data.texas.gov/resource/7358-krk7`) and `SEARCH_GOOGLE_PLACES` (`GOOGLE_PLACES_API_KEY`, real place ids as doc ids). The sink auto-**consolidates** same-brand rows into one multi-location card (`lib/directory-consolidate.ts`, port of `scripts/consolidate-listings.js`; also `GET/POST /api/admin/directory/consolidate`, button on `/admin/scrapeflow`). Seeded verticals: Electrical Contractors (TDLR + Places), Automation & Controls, Industrial Supply, El Paso Hispanic Chamber |

Manage with `gcloud scheduler jobs list/run/pause --location us-central1`. To add a
new cron: create the route with the `CRON_SECRET` check, then add a scheduler job.
For referral rewards, deploy the route first, then create `citybeat-referrals` as
an HTTP GET job at `30 0 * * *` with the same `Authorization: Bearer
${CRON_SECRET}` header used by the other CityBeat cron jobs.

Every cron and the Stripe webhook report failures via `lib/alerts.ts` →
`system_alerts` collection + email to `ALERT_EMAIL` (deduped 3 per 6h per source).

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

# Terminal 2: Trigger test endpoint (requires the shared worker secret)
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: $INGEST_SECRET" \
  -d '{}'
```

### Verification Checklist

Before deployment, verify the automation pipeline end-to-end:

1. **Firestore**: New briefs visible as `pending_review` articles in /admin
2. **Firestore**: Event logs recorded
3. **Email**: Editor notifications sent
4. **Cloudflare Logs**: Execution logged without errors

See `END_TO_END_TESTING_GUIDE.md` for detailed procedures.

## Environment Variables

### Worker Secrets (services/worker/.env.production)

```text
INGEST_SECRET   # auths POSTs to the web app's /api/ingest/brief
RESEND_API_KEY
NEWS_API_KEY
# (Stripe/DeepL/Sanity secrets were removed from the worker on 2026-08-28)
```

### Web App (apps/web/.env.local)

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_APP_URL
ANALYTICS_EXCLUDED_IPS   # Optional, comma-separated IPs excluded from first-party page-view counts (signed-in staff are auto-excluded)
```

See `apps/web/.env.example` for the full list of environment variables.

## Key Development Patterns

### i18n Routing (Web & Ads)

Both Next.js apps use next-intl for language routing:

- Routes: `/en/*`, `/es/*`
- Message files: `src/messages/{en,es}.json`
- Locale context passed through `[locale]` dynamic segment
- **Always-visible EN|ES toggle** in `SiteHeader` (mobile + desktop) — El Paso is ~90% Spanish-speaking, so it's never buried in a menu.
- **Content is bilingual**, not just chrome: articles carry `title_es`/`content_es` (newsroom + creator publish), events/deals have `_es` fields, and directory listings carry `description_es` (translated on save + backfilled by `citybeat-translate-listings`). Translation via `lib/translate.ts` `translateTexts` — DeepL through the worker, **falling back to Claude** (`ANTHROPIC_API_KEY`) when the worker is down, so `_es` reliably populates.

See `packages/lib/i18n/index.ts` for shared utilities.

### Shared Lib Exports

The `@citybeat/lib` package exports multiple entry points:

```typescript
import { /* i18n utils */ } from '@citybeat/lib/i18n'
import { /* geo utilities */ } from '@citybeat/lib/geo'
import { /* tracking */ } from '@citybeat/lib/tracking'
```

### Stripe Integration

- Checkout uses Stripe hosted Checkout sessions (redirect to `session.url`)
- Prices can be pre-configured via env vars or fetched dynamically from Stripe

#### Webhooks (fulfillment)

The canonical (and only) webhook is the **web app** `apps/web/src/app/api/stripe/webhook/route.ts` (the worker no longer processes Stripe). It **requires `STRIPE_WEBHOOK_SECRET`** and fails closed (refuses unsigned events) in production. The single Stripe destination must point at `https://citybeatmag.co/api/stripe/webhook`. Fulfillment: directory claims → `pending_approval` (admin promotes `pending_tier`→`tier`); jobs → published; ad campaigns → active.

#### Monetization in / out

- **In:** directory listing subscriptions (`/api/directory/claim`), ads/sponsored/banner via the web app's `/ads` flow (`/api/stripe/checkout`), paid jobs (`/api/stripe/checkout`), and rep field sales (`/api/sales/checkout`). All charges go to the **single platform Stripe account**.
- **Out (payouts):** Stripe Connect **separate transfers**. Any signed-in user can onboard a bank via `/api/platform/connect/onboarding`; balance/payouts at `/api/platform/connect/balance`. Commission is a configured **percent** (`/admin/payouts` → `/api/admin/payout-settings`) paid only to an **explicitly attributed** `payout_user_id` (set at checkout by a sales/staff caller; never defaults to the payer).
  - **Commission is accrued, not paid instantly.** At `checkout.session.completed` the webhook calls `payoutSplit`, which writes each share to `transfers` as `held` with `eligible_at` = sale + **7 days** (the refund window). `citybeat-payout-cycle` pays matured shares on the **1st and the 15th**. `clawbackCommission` reverses shares on refund/dispute (`held` → `reversed`, costing nothing; already-`paid` → `clawback_owed`, a debt that alerts ops) and on cancellation reverses **held shares only** (`heldOnly: true`) — a customer who received the months they paid for doesn't cost the rep their earned commission. Schedule rules + rep-facing policy copy: `lib/commission-schedule.ts` (unit-tested in `commission-schedule.test.ts`). Reps see held / due / owed-back and the payout date on the Sales Desk and the admin dashboard via `MyEarnings`. `payoutToUser` still pays immediately and is used only by godmode's manual one-off payout. **Commission mode** (godmode, `/admin/payouts`): `one_time` (first payment) or `residual` (every renewal). Godmode can also **issue a flat one-off payout** at `/admin/payouts` → `POST /api/admin/payouts/issue`. Finance overview (read-only): `/api/admin/finance`.

#### Self-serve & field sales

- **Client boost:** a listing owner sees their businesses on `/dashboard` (`/api/directory/mine`) and can upgrade tier via the existing claim checkout (`MyListingsBoost`).
- **Sales virtual checkout / onboarding wizard:** reps (`hasSalesAccess`) use `/admin/sales/new` → `POST /api/sales/checkout` to generate a Stripe Checkout link (QR) on the spot for a directory plan or a custom amount. The sale is attributed to the rep (`payout_user_id`), and a rep-sold directory listing is created `unclaimed` with `sold_by_rep` + `contact_email` (admin attaches the owner on approval). A first-visit quick-start guide walks reps through the single screen, and `POST /api/sales/send-link` emails the payment link to the client (Resend) — and texts it when Twilio is configured (`lib/sms.ts`, dormant until `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM`). Stripe emails the paid receipt automatically.

## Deployment

### Pre-Deployment Checklist

1. Verify all environment variables set (see `apps/web/.env.example`)
2. Run `npm run build && npm run type-check` to ensure clean build
3. Test automation pipeline in staging
4. Review brief content in the /admin review queue before first production run

### Production Deployment

Prod runs on **Google Cloud Run** in GCP project `kerstenblueprint` (region `us-central1`) — NOT Vercel. `citybeatmag.co` is fronted by **Firebase Hosting (Fastly CDN) → Cloud Run `citybeat-web`**. Push to `main` auto-deploys via GitHub Actions.

- **Web** (`citybeat-web`): push to `main` runs `.github/workflows/deploy-web.yml` → builds & deploys to Cloud Run; live at [citybeatmag.co](https://citybeatmag.co). This is the single app — advertising, directory, admin, and sales all live here.
- **Worker**: `cd services/worker && npm run deploy`

> Note: the session cookie MUST stay named `__session` — Firebase Hosting strips every other cookie before forwarding to Cloud Run. Symptom of a regression: auth works on the `*.run.app` URL but 401s on `citybeatmag.co`.

## Debugging Tips

### Worker Logs

Monitor execution via Cloudflare Dashboard:

1. Go to <https://dash.cloudflare.com/>
2. Navigate to Workers → citybeat-worker → Logs tab
3. Filter by timestamp to find recent runs

### DeepL Translation Quota

Monitor usage in DeepL dashboard to avoid hitting API limits during automation.

## Additional Resources

- `Initialization.md` — Project setup and requirements
- `AUTOMATION_SCHEDULE_GUIDE.md` — Cron schedule details
- `STRIPE_SETUP_GUIDE.md` — Payment configuration
- `CLOUDFLARE_SETUP_GUIDE.md` — Edge & DNS setup
- `END_TO_END_TESTING_GUIDE.md` — Full pipeline testing
