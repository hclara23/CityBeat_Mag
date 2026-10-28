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
| `citybeat-directory-ingest` | **PAUSED 2026-10-28** (was 02:00) | `/api/cron/directory-ingest` | crawl/seed local businesses from OSM/Overpass (sales inventory) — 10 verticals, El Paso + Doña Ana counties; insert-only (never touches claimed/paid listings). **Overpass refuses connections from our GCP egress**, so this failed every night from 2026-10-15: the recorded reason is `fetch failed` for all 7 categories, and a one-category call returns 500 in 3.9s — two instant connection failures plus the backoff, not the 2×45s a timeout needs. The IPv6 theory was tested and REFUTED (`api.resend.com`, `api.anthropic.com`, `kvia.com` and `firestore.googleapis.com` all carry AAAA and all work from the same container), and the only IPv4-only mirrors are a dead Japanese host and a Russian one. No env var fixes a refusal at the far end. The route is unchanged and `OVERPASS_URL` is still the no-deploy escape hatch. To re-enable: unpause the job, set `state` back to `ENABLED` in `infra/scheduler/jobs.json`, and restore the `cron:directory-ingest` row in `CRON_EXPECTATIONS` — `cron-cadence.test.ts` fails until you do. Growth now comes from the Socrata feeds, which reach us in under 3s. |
| `citybeat-enrich-contacts` | 03:00 | `/api/cron/enrich-contacts` | find emails/phones for listings |
| `citybeat-sync-events` | 04:00 | `/api/cron/sync-events` | real Ticketmaster events (`TICKETMASTER_API_KEY` set on Cloud Run 2026-07-02); never touches community/featured events |
| `citybeat-sales-agent` | 09:00 | `/api/cron/sales-agent?limit=20` | Claude-written bilingual outbound drip (A/B-tested first-touch subjects) + mid-funnel recovery (abandoned claims, basic→Premium). **Who it mails** is a direct query for listings that HAVE an email, filtered by `planNewContacts()` (published, unclaimed, not merged/held, one pitch per inbox, own-domain inbox) and ordered by `outreachPriority()` (customer-like trades and B2B first, restaurants/cafes last). It used to page ALL listings 80 at a time and skip the ~96% without an email; the cursor fell behind the enriched rows and nothing was sent from 2026-10-16 to 2026-10-28 while the cron reported "ok". **Language** is a hash-assigned 50/50 Spanish/English test (`outreachLocale()`; `locale` + `locale_source` stored on each outreach row; follow-ups keep the first touch's language). Scheduler URI switches, no deploy: `&spanish=0` is English-only, `&spanish=1` all Spanish, `&locale=en\|es` forces one language, `limit=` is the daily new-contact volume. The weekly ops digest prints the ES-vs-EN open/click split. |
| `citybeat-newsletter-digest` | Fri 08:00 | `/api/cron/newsletter-digest` | weekly story digest to subscribers; "Sponsored by" slot from `ad_banners` placement=`newsletter`; dry-run with `?dryRun=1` |
| `citybeat-owner-reports` | monthly 1st 09:00 | `/api/cron/owner-reports` | ROI report (views/leads/reviews) emailed to every claimed-listing owner; basic tier gets Premium upsell |
| `citybeat-upsell` | Tue 10:00 | `/api/cron/upsell?limit=20` | Premium→Featured upsell emails (one per listing) |
| `citybeat-ops-digest` | Mon 08:00 | `/api/cron/ops-digest` | weekly operator heartbeat to `ALERT_EMAIL`: revenue, funnel, inventory, leads, failures |
| `citybeat-account-manager` | Wed 09:30 | `/api/cron/account-manager` | AI marketing drafts (deal, captions, review replies) per paying listing → owner approves on /dashboard; needs `ANTHROPIC_API_KEY` |
| `citybeat-social` | 11:00 | `/api/cron/social?limit=5` | auto-posts recent stories + a weekly "This Weekend in El Paso" roundup (Thu, or `?weekend=1`) to Facebook Page (`FB_PAGE_ID`/`FB_PAGE_ACCESS_TOKEN`) + Threads (`THREADS_USER_ID`/`THREADS_ACCESS_TOKEN`, dormant); IG/X stubbed. Weekly dedup only marks done on a real post |
| `citybeat-auto-articles` | 06:30/11:30/15:30/19:30 | `/api/cron/auto-articles?limit=2` | autonomous newsroom: pulls local outlet RSS (KVIA, El Paso Matters, KTSM, Herald-Post), Claude re-reports each as an original AP-style bilingual brief (`lib/newsroom.ts` `AI_WRITING_RULES`), credits source. Saves EN+ES to `articles` as `pending_review` (→ /admin review queue); `settings.newsroom_auto_publish` or `?publish=1` to auto-publish; `?dryRun=1` to preview. Deduped via `processed_news`. Needs `ANTHROPIC_API_KEY` |
| `citybeat-translate-listings` | 05:00 | `/api/cron/translate-listings?limit=40` | backfills `description_es` for directory listings that have an English description but no Spanish one; self-skips when none remain. (New/edited listings are translated on save in `/api/directory/[id]`.) |
| `citybeat-checkout-recovery` | 07:30 | `/api/cron/checkout-recovery?limit=200&send=1` | **abandoned-checkout recovery. Customer email is ON** as of 2026-10-27 — `send=1` lives on the scheduler job's URI, not in the env, so it is revocable with one `jobs update http` and no redeploy (`CHECKOUT_RECOVERY_EMAILS=on` is the equivalent env switch, still unset). Two passes: it ALWAYS marks `sales_orders` whose Stripe session has lapsed as `checkout_status: 'expired'` (internal truth only — the Sales Desk was showing reps dead payment links as live), and it now also emails each abandoned customer **one** nudge. One nudge per CUSTOMER ever, not per order (a contact holding two abandoned orders got two emails, and a customer who paid on a rep's re-issued link was still told their link expired); stamped only on a real send; suppression-checked; 45-day window, widened only by an explicit `?days=N`. `?dryRun=1` lists exactly who would be contacted — call it **with `send=1`** to be told what the scheduled run does, since a bare dry run reports only the env switch and says so. Logic + copy in `lib/checkout-recovery.ts`. |
| `citybeat-payout-cycle` | scheduler `0 9 1,15 * *` (pays on the 15th) | `/api/cron/payout-cycle` | **pays commission.** Transfers every `transfers` row that is `held` and past its `eligible_at` (7 days after the sale). Commission is NOT paid at sale time — `payoutSplit` accrues it as `held`, the 7-day hold is the refund/change-of-mind window, and the payout gate (`isPayoutCycleDay`) is the **15th and the final calendar day** in America/Denver. This job's scheduler entry fires on the 1st and the 15th, so it only pays on the 15th (the 1st is a no-op that still stamps liveness); **month-end is paid by `citybeat-reconcile-payouts`** (daily 01:00 America/Chihuahua), which calls the same `runPayoutCycle` on any cycle day. Re-checks the cycle day server-side so a stray call can't pay off-cycle; `?force=1` for a deliberate catch-up, `?dryRun=1` to preview. See `lib/commission-schedule.ts` for the schedule rules and the rep-facing policy copy. |
| `citybeat-reconcile-payouts` | 01:00 | `/api/cron/reconcile-payouts?limit=50` | completes commission transfers that didn't go through at webhook time — `transfers` rows in `failed` (funds hadn't settled / Stripe error) or `skipped_no_connected_account` (payee hadn't connected a bank yet). Idempotent: skips already-`paid` shares (ledger check + `transfer_group` backstop), retries with a per-row idempotency key so it never double-pays. Dry-run with `?dryRun=1`. Commission transfers use Stripe `source_transaction` (the charge id) so they succeed against still-pending funds; this cron is the safety net for the residual cases. |
| `citybeat-scrapeflow` | 02:30 | `/api/cron/scrapeflow?limit=3` | **ScrapeFlow** directory-growth scraper (`apps/web/src/lib/scrapeflow/`, admin UI at `/admin/scrapeflow`): a port of the open-source ScrapeFlow workflow engine (Launch browser → Get HTML/Text → Extract links → Crawl pages → Extract listings with AI (Claude) → Deliver to directory). Workflows live in Firestore `scrapeflow_workflows` (JSON node definitions, seeded from `lib/scrapeflow/templates.ts`), runs with per-phase logs in `scrapeflow_runs`. Runs up to `limit` enabled workflows whose `interval_hours` elapsed; `?dryRun=1` previews. Directory sink is **insert-only** (`sf:<hash>` ids, name+street/phone dedupe, El Paso/Doña Ana region filter). Browser backend: plain fetch → Crawl4AI when `CRAWLER_URL` set → Puppeteer locally (`SCRAPEFLOW_BROWSER=puppeteer`). Needs `ANTHROPIC_API_KEY`. Non-browser entry nodes: `FETCH_JSON` + `MAP_JSON_TO_LISTINGS` (open data, e.g. TDLR electrician licenses `data.texas.gov/resource/7358-krk7`) and `SEARCH_GOOGLE_PLACES` (`GOOGLE_PLACES_API_KEY`, real place ids as doc ids). The sink auto-**consolidates** same-brand rows into one multi-location card (`lib/directory-consolidate.ts`, port of `scripts/consolidate-listings.js`; also `GET/POST /api/admin/directory/consolidate`, `?consolidate=1` on the scrapeflow cron, button on `/admin/scrapeflow`).

> **Consolidation PUBLISHES the canonical of every group** — it writes
> `is_published: true` unconditionally — while unpublishing the siblings. So a
> whole-directory run changes the published count in BOTH directions and can
> publish rows that were deliberately left unpublished: the 2026-10-28 run
> merged 1,457 groups, unpublished 2,916 siblings and published ~3,562
> previously-unpublished canonicals, net 9,454 → 10,100. That matters because
> published count is exactly what `SEARCH_MAX_RECORDS` (25,000) caps and what
> the search index re-reads every 15 minutes, so check the headroom before
> consolidating a large unpublished backlog. Do NOT "fix" it by unpublishing a
> canonical: its siblings carry `merged_into` pointing at it, so the whole brand
> would vanish from the directory. Claimed/paid rows are safe — `score()` gives
> `owner_id` +100 and a non-`unclaimed` `claim_status` +50, which beats every
> completeness point available, so they win canonical and stay published.
> `apps/web/scripts/check-consolidation-safety.ts` asserts the one case the
> group-level guard misses (it skips only on >1 `owner_id`): two PROTECTED rows
> sharing a brand key. Run it before any bulk merge. Seeded verticals: Electrical Contractors (TDLR + Places), Automation & Controls, Industrial Supply, El Paso Hispanic Chamber |

| `citybeat-reconcile-orders` | 03:00 | `/api/cron/reconcile-orders?hours=72&replay=1` | **the safety net under the Stripe webhook.** The webhook is the only fulfilment path; if a delivery fails Stripe retries for ~3 days then gives up permanently, and nothing else ever looked back. Walks Stripe's event log for the window and compares it against `stripe_events` (the webhook's own idempotency key, written only on full success), so "did we process this?" has an exact answer. Detection is the route's default; the SCHEDULED job now passes `?replay=1` (2026-10-27), so an unprocessed event is re-delivered to our own webhook with a genuine signature — reusing the production path rather than duplicating money logic — instead of waiting for a human to notice the alert and run the curl by hand. Replaying is safe to automate because `stripe_events` is the idempotency key and only events absent from it are ever replayed. `?dryRun=1` to look without alerting. |
| `citybeat-ghost-reports` | **monthly, 5th 10:00** | `/api/cron/ghost-reports?limit=25` | emails unclaimed-listing owners a "here is what your free listing did this week" report (views, leads, searches) — one of the five claim-growth tactics. Honours the suppression list and one-report-per-listing stamps. **This row said "16:00" (daily) for months and the job has never run daily** — its cron is `0 10 5 * *`, one transposition away from `0 10 * * 5` (Fridays), which is what the report's own "this week" copy implies. At `limit=25` monthly that is ≤300 reports/year across the whole unclaimed directory. Left as-is deliberately: changing it sends materially more customer email, which is an operator decision. `cron-cadence.test.ts` now fails if the heartbeat budget and the real schedule ever disagree again. |
| `citybeat-claims-aging` | 08:00 | `/api/cron/claims-aging` | **a business paid and nobody approved their claim.** Paid claims sit in `pending_approval` waiting on a human; the card was charged at checkout. Alerts past a 48h review target, flags anything past 5 days as breached, and lists the worst ten with names, ages and contact addresses. The clock runs from `claimed_at`, never `updated_at` — any admin action would otherwise reset it and hide the longest-waiting claim. Free Basic claims are excluded: nobody was charged. `?dryRun=1`, `?hours=N`. |
| `citybeat-comp-expiry` | 06:15 | `/api/cron/comp-expiry` | **ends complimentary Premium grants** (`lib/directory-comp.ts`: `comp_tier`/`comp_until` on the listing, e.g. the Sept 2026 warm-leads "3 months free" promo). Returns an unpaid listing to Basic at `comp_until` — never lowers a listing that started paying or a tier something else set — and sends ONE "your free Premium ends soon" email in the last 15 days (suppression-aware, stamped only on a real send). A comp survives a free claim (`directoryApprovalTier`) and is never treated as a paid claim. `resolveEntitlements` also stops honouring a lapsed comp on read, so a late cron can't extend it. `?dryRun=1`. |
| `citybeat-heartbeat` | every 6h | `/api/cron/heartbeat` | **notices a scheduled job that has stopped running.** Until this existed, a cron could simply die and the only symptom was that its work quietly stopped happening. Compares every source in `CRON_EXPECTATIONS` (`lib/ops-health.ts`) against its last `reportSuccess` stamp in `system_health`. A `tracking_since` marker stops the first deploy paging about jobs that merely have not run yet. **A source only counts as live if a route actually calls `reportSuccess('<source>')`** — `ops-health.test.ts` reads the cron routes and fails if the expectation table and the code disagree in either direction. |

Manage with `gcloud scheduler jobs list/run/pause --location us-central1`.

> **The directory search index is the Firestore bill.** `/api/directory` keeps a
> process-local index (`lib/directory-search.ts`) rebuilt by re-reading every
> published listing (~11k reads). At the old fixed 15-minute TTL that was ~96
> rebuilds/day, about 80% of measured Firestore spend (~$19 of ~$24/month,
> October 2026). The TTL is now 6 hours; `SEARCH_MIN_REBUILD_MS` (15 min) is the
> floor, and writers that change matching or ranking (Stripe webhook events, claim
> decisions, listing edits, bulk publish, ScrapeFlow inserts, consolidation) call
> `bumpDirectoryIndexVersion()` (`lib/directory-index-version.ts`), which pulls a
> rebuild forward — but never faster than the floor. Results are re-hydrated from
> live documents, so a stale index can only mis-match or mis-rank, never serve an
> unpublished row. A NEW write path that changes tier, visibility, name, category
> or address should bump the marker too; forgetting costs at most one TTL.
> `consolidateListings` still re-reads the whole collection per ScrapeFlow run with
> inserts — the next cost to look at.
>
> **The claim funnel is instrumented** (`lib/claim-funnel.ts`, collection
> `claim_funnel_events`, 180-day TTL on `expires_at`): the claim page view
> (`/api/track/claim-step`, signed-in state read server-side), every verification
> code request with its outcome (`sent`, `sms_not_enabled`, `unavailable`, …), and
> checkout start. Those three left no trace before. The weekly ops digest prints
> the funnel line. Enable the TTL policy once with `gcloud firestore fields ttls
> update expires_at --collection-group=claim_funnel_events --enable-ttl`.

**The 22 jobs are declared in `infra/scheduler/jobs.json`.** Run `npm run
scheduler:check` to diff live against that manifest — it reports missing jobs,
undeclared jobs, **undeclared** pauses, schedule drift, any job with no retries,
and any job whose last run FAILED; it changes nothing.

> A pause the manifest also declares (`"state": "PAUSED"` plus a
> `pausedReason`) is intent, not drift, so it is not reported — and a declared
> pause suppresses the stale `status.code` of the run that caused it. Flagging a
> deliberate pause forever left a permanently-red check, which teaches whoever
> reads the output to skim past it. A pause nobody declared is still a problem,
> and a declared/live state mismatch is caught as ordinary drift because `state`
> is one of the compared fields. `cron-cadence.test.ts` requires a paused job to
> carry a `pausedReason` and exempts it from needing a heartbeat budget. After a deliberate change, `npm run scheduler:capture` rewrites
the manifest. `Authorization` header VALUES are never stored there, only the fact
that the header must be present.

> **The manifest alone cannot catch a job that was created wrong.** It is
> captured FROM live, so a bad schedule becomes the declared intent and
> `scheduler:check` reports "no drift" forever after — which is exactly how
> `citybeat-ghost-reports` ran monthly for months while this file said daily.
> The second, independent description of each job's cadence is `CRON_EXPECTATIONS`
> in `lib/ops-health.ts` (the heartbeat's staleness budget), and
> `cron-cadence.test.ts` now reads BOTH real files and fails when a budget
> contradicts the schedule the job actually runs on — e.g. a monthly job with a
> nine-day budget, which pages every six hours for three weeks out of four about
> a healthy job and teaches whoever reads those alerts to ignore them.

> **Two Google accounts are authenticated on the dev machine and only one can
> read this project.** With the wrong one active, `env:check` and
> `scheduler:check` both fail with what looks like a sign-out. They now name
> the authenticated accounts and the `-- --account <email>` flag to pass. This
> is not cosmetic: while those checks could not start, nothing could report on
> any job's schedule at all.
>
> An earlier version of this note cited `citybeat-social` running every ten
> minutes as that failure's proof. It is NOT drift: `social/route.ts` returns
> early after draining the image queue on every run except the 11:00-11:09
> window, so `*/10` is 143 cheap queue drains plus one real posting run a day,
> and the `&queue=1` in its target is what selects that behaviour. Left here
> because the note previously read as a defect and would send whoever acted on
> it to "fix" a job that is working as designed.

**Verify a new or changed job by its OWN recorded outcome, not by calling it by
hand.** `gcloud scheduler jobs list --format="csv(name.basename(),state,lastAttemptTime,status.code)"`
— a non-empty `status.code` means the last run FAILED (13 = INTERNAL). A hand-run
dry-run with different query params proves nothing about what the scheduler
executes: `citybeat-reconcile-orders` was verified that way and had in fact 500'd
on every scheduled run since creation. A dry run must also be a true preview:
`?dryRun=1` on `/api/cron/sales-agent` used to write `recovery_outreach` and
`upsell_outreach` rows that the next real run read as "already contacted", so a
look at who would be nudged permanently cancelled those nudges. It no longer
writes anything (`sales-agent-dry-run.test.ts` runs dry then real on the same
fake database and requires the real run to still send).

> **Every cron honours `?dryRun=1`, and a preview changes nothing and says
> nothing.** That means: no writes, no sends or posts, no webhook calls, no
> persisted-cursor advance, no `reportFailure` alert, and **no `reportSuccess`**
> — the liveness stamp means "the scheduler fired", and a hand-run preview that
> stamped it hid a genuinely stopped job from the heartbeat for its whole budget.
> Five jobs ignored the flag entirely and ran for real (`social` would have posted
> to the Facebook Page, `sync-events` deleted event rows, `enrich-contacts` wrote
> emails onto listings and moved its cursor, `translate-listings` spent
> translations, `directory-ingest` inserted); nine more honoured it but still
> stamped liveness; ScrapeFlow's `DELIVER_VIA_WEBHOOK` step POSTed during a
> preview. `cron-dry-run.test.ts` reads every cron route and fails if one does not
> read the flag or has a `reportSuccess` its own line does not guard (the few that
> a preview provably cannot reach are listed there with the reason).
> `cron-dry-run-behavior.test.ts` and `scrapeflow/webhook-dry-run.test.ts` run the
> five formerly-live jobs and the webhook step dry then real. ScrapeFlow itself
> still records a `scrapeflow_runs` row marked `dry_run` (that is how the preview
> is read back) and seeds missing bundled templates.

> **A failed send is not a sent pitch.** `sales_outreach`, `recovery_outreach` and
> `upsell_outreach` all dedupe on a row's existence, whatever its status, so a
> `send_failed` row used to cancel that business's one touch for good — one
> provider outage or a missing `RESEND_API_KEY` could burn a whole day's batch,
> unnoticed. A failed send is now retried in place (same row, `send_attempts`
> counted) up to `MAX_SEND_ATTEMPTS` (3), except a refused address
> (`resend_400`/`resend_422`, `sendFailureIsFinal`), which settles at once. A run
> that sees `HALT_AFTER_CONSECUTIVE_FAILURES` (3) failures in a row stops rather
> than spend the queue, reports `halted`, and raises the `sales-agent-send-failures`
> alert (the liveness stamp still means only "the job ran"). A follow-up that fails
> does NOT advance the drip step (it used to, so the reminder was skipped and the
> next one sent in its place); after 3 failures it is given up on
> (`followup_failures`). Tests: `sales-agent-failed-sends.test.ts`.

To add a
new cron: create the route with the `CRON_SECRET` check, then add a scheduler job,
then add it to `infra/scheduler/jobs.json` (or run `scheduler:capture`).
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

# Run every test. DISCOVERS *.test.ts — there is no list to keep up to date.
# Grouped by nearest tsconfig and run from that directory, because path aliases
# (`@/lib/...`) only resolve against the tsconfig that declares them.
npm test
npm run test:list        # what would run, without running it

# Diff live infrastructure against what the repo declares. Both are read-only.
npm run scheduler:check  # missing/undeclared/paused jobs, schedule drift, no-retry jobs
npm run scheduler:capture# rewrite the manifest AFTER a deliberate change
npm run env:check        # missing or undeclared env vars — NAMES only, never values
```

> The test gate used to be a hand-maintained list of ~43 paths inside
> `package.json`. It had already drifted: a committed test file with 7 passing
> tests had never run in CI once, so it could have been failing for weeks behind a
> green gate. Do not reintroduce a list — write a `*.test.ts` anywhere and it runs.

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
INGEST_SECRET   # auths POSTs to the web app's /api/ingest/brief, AND auths the
                # web app's own POSTs to the worker's /api/translate
RESEND_API_KEY
NEWS_API_KEY
DEEPL_API_KEY   # REQUIRED. The worker is where the DeepL key lives.
ALERT_EMAIL     # SEPARATE from the web app's. See the note below.
# (Stripe and Sanity secrets were removed from the worker on 2026-08-28.)
```

> **`ALERT_EMAIL` is two variables, not one.** The worker reads its own wrangler
> binding (`services/worker/src/handlers/automation.ts`), so setting
> `ALERT_EMAIL` on Cloud Run does nothing for it and it keeps falling back to
> the single hardcoded address. That fallback covers the one case the binding
> exists for: brief automation failed AND could not reach
> `/api/cron/heartbeat` — the path that exists precisely because silence and
> success look identical. If you add a co-responder on Cloud Run, add them to
> the worker too (`wrangler secret put` / a `vars` entry), and keep it a SINGLE
> address there: nothing in the worker splits a list.

> **DeepL is NOT gone from the worker** — an earlier revision of this file said it
> was, and that was wrong in a way that would bite whoever acted on it. The worker
> still holds `DEEPL_API_KEY` and serves `POST /api/translate`
> (`services/worker/src/handlers/translate.ts`); the web app's `lib/translate.ts`
> calls it as the PRIMARY translation path and only falls back to Claude when the
> worker is unreachable. Drop that secret and every listing, article and event
> quietly stops being translated by DeepL and starts costing Anthropic tokens
> instead — with nothing failing loudly enough to notice.

### Web App (apps/web/.env.local)

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_APP_URL
ANALYTICS_EXCLUDED_IPS   # Optional, comma-separated IPs excluded from first-party page-view counts (signed-in staff are auto-excluded)
```

**`infra/cloud-run/env.json` is the authoritative inventory** — every variable
name, what breaks without it, and whether absence fails loudly or quietly.
`npm run env:check` diffs it against the live service in both directions, and
`scripts/check-env.mjs` scans `apps/web/src` and `packages/lib/src` for
`process.env.*`, so a variable the code reads but the manifest omits is
reported.

> Do NOT follow `apps/web/.env.example` for this. It is a stale Sanity-era file
> — it still lists `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN` and
> `NEXT_PUBLIC_STUDIO_URL` for a CMS removed in June 2026 — and it omits
> variables that are actually load-bearing, `ALERT_EMAIL` and
> `SALES_FROM_EMAIL` among them. Nothing reads it: `check-env.mjs` never opens
> it, so adding a name there satisfies no check. These two lines used to call it
> "the full list of environment variables".

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
  - **Commission is accrued, not paid instantly.** At `checkout.session.completed` the webhook calls `payoutSplit`, which writes each share to `transfers` as `held` with `eligible_at` = sale + **7 days** (the refund window). `citybeat-payout-cycle` pays matured shares on the **15th**, and `citybeat-reconcile-payouts` on the **final calendar day** of the month (both via `runPayoutCycle`, gated by `isPayoutCycleDay`). `clawbackCommission` reverses shares on refund/dispute (`held` → `reversed`, costing nothing; already-`paid` → `clawback_owed`, a debt that alerts ops) and on cancellation reverses **held shares only** (`heldOnly: true`) — a customer who received the months they paid for doesn't cost the rep their earned commission. Schedule rules + rep-facing policy copy: `lib/commission-schedule.ts` (unit-tested in `commission-schedule.test.ts`). Reps see held / due / owed-back and the payout date on the Sales Desk and the admin dashboard via `MyEarnings`. `payoutToUser` still pays immediately and is used only by godmode's manual one-off payout. **Commission mode** (godmode, `/admin/payouts`): `one_time` (first payment) or `residual` (every renewal). Godmode can also **issue a flat one-off payout** at `/admin/payouts` → `POST /api/admin/payouts/issue`. Finance overview (read-only): `/api/admin/finance`.

  - **A renewal is attributed from the SUBSCRIPTION doc, not the order.** `payResidualCommissionIfDue` reads `subscriptions/{id}.payout_user_id`; a subscription without one is treated as having NO seller, so the editor earns the 40% "autonomous" rate instead of the 45% editor-sold rate (and a rep-sold renewal would lose the rep's share entirely). That is how the Founding subscription's 2026-10-22 renewal accrued $4.00 instead of $4.50 even though its sales order says `sold_by` = the editor. Fixed 2026-10-28: the field was backfilled and the held row corrected to 450c @ 45% with `adjusted_from_amount` / `adjusted_from_percent` / `adjustment_reason` recording what it was. If a renewal's percent ever looks low, check `subscriptions/{id}.payout_user_id` first. `payoutSplit` re-writes `amount`/`percent` on an existing HELD row for the same invoice, so editing a row by hand only sticks once the attribution is also right.

#### Self-serve & field sales


- **Client boost:** a listing owner sees their businesses on `/dashboard` (`/api/directory/mine`) and can upgrade tier via the existing claim checkout (`MyListingsBoost`).
- **Sales virtual checkout / onboarding wizard:** reps (`hasSalesAccess`) use `/admin/sales/new` → `POST /api/sales/checkout` to generate a Stripe Checkout link (QR) on the spot for a directory plan or a custom amount. The sale is attributed to the rep (`payout_user_id`), and a rep-sold directory listing is created `unclaimed` with `sold_by_rep` + `contact_email` (admin attaches the owner on approval). A first-visit quick-start guide walks reps through the single screen, and `POST /api/sales/send-link` emails the payment link to the client (Resend) — and texts it when Twilio is configured (`lib/sms.ts`, dormant until `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM`). Stripe emails the paid receipt automatically.

## Deployment

### Pre-Deployment Checklist

1. Verify all environment variables set — `npm run env:check` against `infra/cloud-run/env.json` (NOT `.env.example`, which is stale; see above)
2. Run `npm run build && npm run type-check` to ensure clean build
3. Test automation pipeline in staging
4. Review brief content in the /admin review queue before first production run

### Production Deployment

Prod runs on **Google Cloud Run** in GCP project `kerstenblueprint` (region `us-central1`) — NOT Vercel. `citybeatmag.co` is fronted by **Firebase Hosting (Fastly CDN) → Cloud Run `citybeat-web`**. Push to `main` auto-deploys via GitHub Actions.

- **Web** (`citybeat-web`): push to `main` runs `.github/workflows/deploy-web.yml` → builds & deploys to Cloud Run; live at [citybeatmag.co](https://citybeatmag.co). This is the single app — advertising, directory, admin, and sales all live here.
- **Worker**: `cd services/worker && npm run deploy`

> Note: the session cookie MUST stay named `__session` — Firebase Hosting strips every other cookie before forwarding to Cloud Run. Symptom of a regression: auth works on the `*.run.app` URL but 401s on `citybeatmag.co`.

The pipeline is a **canary, not a straight-to-production push**: it deploys with
`--no-traffic --tag candidate`, smoke-tests the candidate on its own tagged URL
while the previous revision keeps serving, promotes only on success, re-verifies
through the CDN, and **rolls traffic back automatically** if that fails. A build
that fails its smoke test is simply never promoted, so no customer sees it. The
smoke test asserts `/xx`, `/xx/directory` and an unmatched path all return **404** —
both of those regressions have actually shipped.

### Customer support and privacy requests

`/[locale]/contact` is the support path, in both languages. It **stores the message
before anything else can fail**, into `quote_requests` — the inbox `/admin/leads`
already renders — so it cannot be lost to a bounce or an unwatched mailbox. Four
different addresses are published across the site (`hello@`, `support@`, `contact@`,
`ads@`) and a customer has no way to tell which are monitored; a message landing in
an unread inbox looks exactly like being ignored, and the next move after "nobody
answered" is a card dispute.

Two topics are **escalated immediately** via `reportFailure`, not merely filed:
- `billing` — someone has been charged and needs help
- `privacy` — the published policy promises a response within 30 days, and that
  clock starts whether or not anyone has opened the queue

The Terms' refund clause, the billing terms shown at checkout, the privacy policy
and the footer all point here, so the promise made at the moment of payment matches
what actually exists.

### Google Places ingest is DISABLED

`SEARCH_GOOGLE_PLACES` refuses to run (`lib/scrapeflow/executors.ts`) and the
directory sink refuses to persist Places-derived rows (`lib/scrapeflow/google-content.ts`).
Storing Places fields indefinitely breaches the No-Caching term and publishing them
as a searchable business directory breaches No-Re-Creating-Google-Features; the
remedy Google applies is killing `GOOGLE_PLACES_API_KEY`, which also feeds contact
enrichment and the sales pipeline.

The refusal is at the EXECUTOR on purpose: the 16 Places workflows were already
seeded into Firestore with `enabled: true`, and the template file is only consulted
when seeding, so disabling the templates alone would not have stopped them.
`ALLOW_GOOGLE_PLACES_INGEST=true` exists solely so re-enabling is an explicit
decision — it needs a licensing answer, not a code change.

Rows written before the guard are removed from **/admin/scrapeflow → "Places
cleanup"**. It reports first (read-only) and requires a confirmation showing real
names. **Nothing protected is ever touched**: any claim at any stage, any owner, any
subscription or paid tier, any rep-sold row, and a named allowlist (currently
Varsity Roofing). Those rules are pure and tested in `lib/places-cleanup.test.ts`,
each row is re-checked against its CURRENT document immediately before deletion, and
every deletion is archived to `deleted_listings` first, so it is reversible.

### Monitoring, and what pages a human

| Probe | Question it answers | On failure |
|---|---|---|
| `/api/health` | is the site up? (real bounded Firestore read; 503 when the DB is unreachable) | uptime `citybeat-health` → alert **"CityBeat site down"** |
| `/api/health/payments` | **can we take money?** (Stripe key authenticates) | uptime `citybeat-payments` → alert **"CityBeat CANNOT TAKE PAYMENTS"** |
| `/en` | does the homepage render? | uptime `citybeat-homepage` → same site-down alert |

`/api/health/payments` is deliberately **separate** from `/api/health`, which stays
200 during a payments outage: the site being up and the business being able to
charge a card are different questions with different urgencies, and `/api/health`
is also the deploy pipeline's smoke test — folding them together would block the
very deploy that fixes payments. It fails **only** on a Stripe AUTHENTICATION
error; a Stripe outage or a network blip is reported in `detail` and still returns
200, so nobody is paged for someone else's incident.

This exists because the live Stripe key was rejected for two days
("Expired API Key provided") while every other surface stayed green — the site
served news, directory, search and sign-in perfectly and simply could not take a
payment. Nothing watched for that.

> **Never create or update a gcloud uptime check from Git Bash** — MSYS mangles
> `--path` into `/C:/Program Files/Git/...`, which is how two checks silently
> probed a nonexistent path for three months. Use PowerShell. And note that
> `gcloud monitoring uptime create --port=443` does **NOT** set `useSsl`: the check
> then does plain HTTP to 443 and fails 100%, looking exactly like a real outage.
> Pass `--protocol=https` at create, or PATCH `httpCheck.useSsl` via the Monitoring
> REST API. **Confirm the check actually reports PASS before trusting it.**

### Rollback

Cloud Run keeps every revision. To undo a bad deploy without waiting for a build:

```bash
gcloud run revisions list --service citybeat-web --region us-central1 --project kerstenblueprint --limit 5
gcloud run services update-traffic citybeat-web --region us-central1 --project kerstenblueprint \
  --to-revisions <GOOD_REVISION>=100
```

### Disaster recovery (Firestore)

Posture: **daily backups** (7d retention) + **weekly** (56d), **PITR enabled** (7-day
window, ~1 minute granularity), and **delete protection enabled**.

A Firestore restore ALWAYS creates a **NEW** database — it can never overwrite
`(default)`. The app therefore reads `FIRESTORE_DATABASE_ID` (see
`packages/lib/src/firebase/admin.ts`); unset it resolves to `(default)`, so
recovery is a config change, not an emergency code edit:

```bash
# 1a. Restore from a scheduled backup
gcloud firestore backups list --location=nam5 --project kerstenblueprint
gcloud firestore databases restore \
  --source-backup=projects/kerstenblueprint/locations/nam5/backups/<BACKUP_ID> \
  --destination-database=citybeat-restored --project kerstenblueprint

# 1b. …or to an exact moment within the last 7 days (PITR)
gcloud firestore databases restore \
  --source-database='(default)' --snapshot-time=2026-09-03T14:31:00Z \
  --destination-database=citybeat-restored --project kerstenblueprint

# 2. Point the live app at it (takes effect on the next revision)
gcloud run services update citybeat-web --region us-central1 --project kerstenblueprint \
  --update-env-vars FIRESTORE_DATABASE_ID=citybeat-restored

# 3. To go back: --update-env-vars FIRESTORE_DATABASE_ID='(default)'
```

What Stripe does NOT hold, and therefore what a restore is actually protecting:
commission attribution (`payout_user_id`), accrued-but-unpaid `transfers` rows,
claim ownership, activated tier, and per-order cart amounts. Charges themselves
can always be re-derived from Stripe; this state cannot.

> Not yet rehearsed end-to-end. A restore creates a second billed database, so do
> it deliberately: restore, point a *staging* revision at it, verify, delete it.

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
