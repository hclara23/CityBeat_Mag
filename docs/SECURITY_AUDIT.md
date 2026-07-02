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
