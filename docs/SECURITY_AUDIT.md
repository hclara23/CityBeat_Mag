# Security & Correctness Audit — Launch Hardening

Running record of the file-by-file audit of the CityBeat app (`apps/web`,
`packages/lib`, `packages/ui`, `services/worker`) performed ahead of running it
as an unattended, revenue-generating service. Each wave = audit → fix → re-audit.

Baseline commit at start of wave 1: `523bce9`. Latest recorded: `0ce2265`.

## Verification gates (every wave)

- `npm run type-check` (root, Turbo) — must pass
- `npm run test` (root) — `roles` + `directory-security` unit suites, must pass
- `npm run build` — must pass on Node 20
- Push to `main` → GitHub Actions `deploy-web.yml` → Cloud Run `citybeat-web`

## Wave 1 — money + auth surface (commit `1875f59`)

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 1a | **Critical** | Payouts | `payoutToUser` could double-pay a rep on Stripe webhook retry / concurrent delivery — no idempotency around `transfers.create`. | Firestore dedup guard (source_payment + service + payee, status `paid`) **and** a Stripe `idempotencyKey` on the transfer. |
| 1b | **High** | Webhook | Stripe webhook had no event-level dedup; at-least-once delivery re-ran handlers. | `stripe_events/{event.id}` guard: skip if seen, mark processed only after success (so partial failures still retry). |
| 2 | High | Chat API | `/api/chat` unauthenticated, unthrottled, unbounded message size (cost/abuse). | IP rate limit 30/hr → 429; each message capped to 2000 chars. |
| 3 | High | Admin XSS | `/admin/review/[id]` rendered brief content via `dangerouslySetInnerHTML` — stored XSS in an admin session. | Render as text (`whitespace-pre-wrap`). |
| 4 | Medium | Public forms | `/api/jobs` and `/api/newsletter/subscribe` unthrottled + no email length cap. | Rate limits (10/hr jobs, 15/hr newsletter) + email length validation. |
| 5 | Medium | Tests/CI | Access-control logic (`roles`) had no tests; CI ran `npm run test || true` (never failed). | 9 `roles` unit tests; CI now enforces `npm run test`. |
| 6 | Medium | Performance | `/api/sales/me` scanned **all** profiles to build the leaderboard. | Aggregate transfers → top-10, then fetch only those 10 profiles by id. |

## Wave 2 — re-audit (commit `0ce2265`)

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 7 | **High** | Open redirect | `/api/stripe/checkout` used a client-supplied `returnUrl` directly in `success_url`/`cancel_url` (post-checkout phishing). Route is public + unthrottled. | Same-origin validation (falls back to `/en/ads/success`); IP rate limit 20/hr; dropped `sk_test_placeholder` fallback; stopped leaking `error.message`. |

**Confirmed safe (false alarms), no change:**

- `/api/customer-portal` — already validates `returnUrl` same-origin **and**
  verifies the `customerId` belongs to the caller before opening a Stripe portal.
- All 7 `/api/cron/*` routes fail **closed** when `CRON_SECRET` is unset.
- Every `<script type="application/ld+json">` block escapes `<`
  (`jsonLdSafe()` or inline `<`), so no JSON-LD breakout XSS.
  `events/[id]` refactored to use the shared `jsonLdSafe()` helper (no behavior change).

## Wave 3 — automation engine (webhook + crons)

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 8 | Medium | Webhook ledger | Case-3 advertiser purchase used `ad_purchases.add()` (new doc each call). A retry after a *partial* handler failure created a **duplicate ledger row**, double-counting revenue in `/api/admin/finance`. Every other write in the file is an idempotent `.doc(id).set(merge)`. | Key the row on the Stripe session id: `ad_purchases.doc(session.id).set(..., { merge: true })`. |

**Reviewed, no change needed:**

- `sales-agent` follow-up due-date logic (`lib/sales-agent.ts`) is redundant but
  functionally correct (send when `now - last_sent_at >= step gap`).
- Payout attribution never defaults to the payer — commission only pays an
  explicitly-attributed `payout_user_id`. Residual commission is dedup'd per invoice.

## Wave 4 — money-in routes (checkout & claim)

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 9 | Medium | Directory claim | `/api/directory/claim` only blocked a re-claim when the listing was already `approved`. A second payer could check out for a listing that was `pending_approval` under another account; the webhook would clobber `owner_id`, charging the first payer for a listing they lose (refund/chargeback risk). | Block when `claim_status ∈ {approved, pending_approval}` and a *different* `owner_id` already exists → `409`. |

**Reviewed, no change needed:**

- `/api/sales/checkout` — sales-access gated; pricing server-set via `getPlan()`;
  custom amount validated (`> 0`, finite); `payout_user_id` attributes to the
  authenticated rep, never the payer; success/cancel URLs built server-side from
  the request origin.
- `/api/directory/claim` — server-set pricing; **payout self-attribution guard**
  (`payout_user_id` honored only if the caller `hasSalesAccess`, so a self-serve
  advertiser can't redirect a commission to themselves); Founding-100 cap enforced
  server-side via `.count()`.
- `/api/track/click` — open-redirect safe: `to` must be a `/`-relative path (and
  not `//`), and the redirect is always prefixed with `APP_URL` (origin fixed).

## Wave 5 — Cloudflare Worker (`services/worker`)

| # | Severity | Area | Finding | Fix |
|---|---|---|---|---|
| 10 | Medium | Worker abuse | `/api/test-automation` was **unauthenticated** — a public caller could trigger the full brief pipeline (NewsAPI + DeepL quota burn, Sanity draft spam, editor email spam) at will. | Gate behind the shared `x-ingest-secret` header (same guard `/api/translate` already uses). CLAUDE.md curl example updated. |
| 11 | Trivial | Repo hygiene | `services/worker/tmpclaude-a83d-cwd` — a stray 36-byte artifact committed by accident. | Removed from git. |

**Reviewed, no change needed:**

- Worker has **no live Stripe handler** — routes are `/health`, `/api/tracking`,
  `/api/translate`, `/api/test-automation`, catch-all 404. Stripe is web-app-only.
  The `STRIPE_*` fields in the `Env` type are vestigial and unused.
- `/api/translate` authenticates with `x-ingest-secret`.
- `/api/tracking` handler is a no-op stub (`console.log` only, no writes) — nothing
  abusable; real analytics is the web app's `/api/track/pageview`.

## Wave 6 — money-OUT (payouts) — **no findings**

The highest-risk surface (direct fund movement). Audited, all sound:

- `/api/admin/payouts/issue` and `/api/admin/payout-settings` require
  **developer** (godmode) access, enforced before any money moves.
- `manualPayout` and `payoutToUser` both resolve the transfer **destination from
  the payee's own `stripe_connected_accounts/{userId}` record** — never from the
  request — and require `payouts_enabled`. Funds can only reach a user who
  onboarded their own bank; no request-controlled destination.
- Automated commission (`payoutToUser`) is idempotent per source payment (wave 1);
  manual godmode payouts are intentionally distinct per issue (no idempotency by
  design).
- `/api/platform/connect/*` let any authenticated user manage **their own** bank
  onboarding/balance only (by design).

## Status

Six waves. Finding counts per wave: **6 → 1 → 1 → 1 → 2 → 0**. The core
revenue surfaces — money-in (checkout/claim), money-out (payouts), webhook
fulfillment, cron auth, and the outbound sales engine — are hardened and, on the
final pass, produced no new issues. The app is in a defensible state to run as an
unattended, revenue-generating service. Remaining items below are scale/quality,
not correctness or security.

> **Deploy note:** web-app fixes auto-deploy on push to `main` (Cloud Run). The
> wave-5 **worker** change ships separately — run `cd services/worker && npm run
> deploy` to make the `/api/test-automation` auth gate live.

## Known limitations (accepted for launch, not bugs)

- **`sales_outreach` follow-up query is unbounded** (`lib/sales-agent.ts`, the
  `status in [...]` read has no `.limit()`). Fine at launch scale (hundreds of
  listings); at 10k+ outreach docs it becomes a read-cost/memory concern. A naive
  `.limit()` would *silently starve* follow-ups outside the first page, so the
  correct fix is a `next_followup_at` field + range query + composite index —
  deferred as a scale task, not band-aided.
- **`directory/[id]/page.tsx` is a ~1,300-line god component.** Maintainability
  debt, not a correctness/security issue; refactor deferred (high risk, low
  launch value).

## Operator toggles intentionally left OFF

- `newsletter-digest` Cloud Scheduler job — **PAUSED** (dry-run with `?dryRun=1`).
- `social` Cloud Scheduler job — **PAUSED** (scaffold only).
- `auto_approve_claims` platform setting — **OFF** (admins approve claims manually).
