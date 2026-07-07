# Money Pipeline Verification — 2026-07-03

Full end-to-end audit of every pay-in and pay-out path, verified against the
**live** Stripe account and production Firestore.

## Bottom line

**The payment infrastructure is real, live, and working.** Purchases can be made
right now. **Zero real sales have happened yet** — every number that looked like
revenue was seed/mock data, now removed. The app hasn't "produced" because it's
only just started reaching real prospects with valid emails, not because
anything is broken.

## Stripe — verified live

| Check | Result |
|---|---|
| Secret key mode | `sk_live_…` ✅ |
| Account | Elevate Media (US), `charges_enabled: true`, `payouts_enabled: true` ✅ |
| Webhook endpoint | `https://citybeatmag.co/api/stripe/webhook`, status **enabled**, 61 events ✅ |
| Webhook secret | set on Cloud Run ✅ |
| Webhook fail-closed | unsigned POST → **HTTP 400** (rejects forged events) ✅ |
| Live checkout session | created a real `cs_live_…` subscription session → valid `checkout.stripe.com` pay URL ✅ |
| Rep-sale session | created with correct `payout_user_id` / `sold_by` / `tier` attribution ✅ |
| Real charges to date | **0** (confirmed via Stripe API) |

## Pay-IN paths

| Path | Route | Status |
|---|---|---|
| Self-serve claim/upgrade | `/api/directory/claim` → Stripe subscription | ✅ server-set pricing (`getPlan`), payout self-attribution guard, founding cap, double-claim 409 |
| Rep field sale (QR/link) | `/api/sales/checkout` → Checkout link + **QR on `/admin/sales/new`** | ✅ sales-gated, server-set plan or custom amount, rep attribution |
| Jobs / ad campaigns | `/api/stripe/checkout` | ✅ same-origin returnUrl, rate-limited |
| Customer billing portal | `/api/customer-portal` | ✅ ownership-verified |

## Pay-OUT paths

| Path | Route | Status |
|---|---|---|
| Automated commission | webhook → `payoutToUser` | ✅ idempotent, destination resolved from payee's own connected account, requires `payouts_enabled` |
| Residual commission | `invoice.payment_succeeded` | ✅ dedup per invoice, godmode `residual` mode |
| Godmode flat payout | `/api/admin/payouts/issue` | ✅ developer-gated, destination = payee's own account |
| Failed-renewal recovery | `invoice.payment_failed` → dunning email | ✅ hosted invoice pay link, dedup per invoice |

## Webhook fulfillment (per type)

- `checkout.session.completed` → directory claim (pending_approval / auto-approve if verified), job publish, ad-campaign activate, generic ad_purchase (idempotent by session id), payout, outreach→converted.
- `invoice.payment_succeeded/failed` → subscription status, dunning.
- `customer.subscription.deleted` → downgrade to basic + 30-day win-back stamp.
- `charge.refunded` → mark refunded, downgrade listing.

## What was mock/seed data (now cleaned)

| Item | Was | Action |
|---|---|---|
| "$50 sale" in dashboard | `transfers/…` with `payee_user_id: test_uid_123`, `source_payment: ch_mock123` | **deleted** |
| "1 paying listing" | `seed-elevate-el-paso` premium, no owner, no subscription (house/showcase) | flagged `is_house_account`; excluded from revenue metrics |
| Other seed listings | 4 more `seed-*` demo businesses | flagged `is_house_account` |

## Email open/click — real, with a caveat

- Outreach emails **are really being sent** to real businesses (Resend). Open (pixel) and click (redirect) tracking **works** — one business (Grimaldi's) genuinely logged 2 opens + 2 clicks.
- **Caveat:** some "opens" are corporate mail-scanner prefetches, not humans. A **click** is the reliable buying signal.
- **New:** the **Warm-leads board** on `/admin/sales/me` now surfaces exactly who opened/clicked, ranked hot→warm, so reps call the engaged businesses first.

## Root cause of "not producing yet"

1. **Junk scraped emails** — ~19% of targets were `user@domain.com`, web-agency inboxes (`hi@typemade.mx`), `abuse@…`, `ejemplo@email.com`. Fixed the scraper's filter + scrubbed 13 bad addresses; follow-ups to 6 bad records stopped.
2. **No warm-lead visibility** — engaged prospects (like Grimaldi's) were invisible; now boarded for follow-up.
3. **Genuinely early** — real, valid-email outreach volume has only just begun. The rails are proven; the funnel now needs volume + human follow-up on warm leads.

## To take a real test payment (optional)

Since Stripe is in live mode, test cards don't work. To prove end-to-end
fulfillment with real money: make a $9.99 Founding claim on a listing you own,
watch the webhook set it `approved`, then refund it from the Stripe dashboard
(the `charge.refunded` handler will downgrade it). ~$0 net cost.
