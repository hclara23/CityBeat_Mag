# Plan 005: Finance numbers tell the truth (refunds unbook, no double-count, owed commission visible, one-time sales in the digest)

> **Executor instructions**: Follow step by step; run every verification;
> honor STOP conditions; update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/app/api/stripe/webhook/route.ts apps/web/src/app/api/admin/finance/route.ts apps/web/src/app/api/cron/ops-digest/route.ts apps/web/src/lib`
> Mismatch with excerpts = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (reporting + one additive webhook write; no money movement changes)
- **Depends on**: none
- **Category**: bug (revenue_misrecorded)
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

Four confirmed distortions make the operator's numbers wrong in both
directions:

1. **Refunded subscription revenue is counted as collected forever.** Refunds
   patch `ad_purchases` and `sales_orders` but never the `payments` collection
   (invoice ledger), and the finance dashboard counts `payments` rows with
   status `paid`.
2. **The first month of every non-directory subscription is counted twice** —
   once as the checkout's `ad_purchases` row (`payment_status: 'completed'`)
   and once as the first invoice's `payments` row (`status: 'paid'`). Both
   pass the dashboard's paid filter.
3. **`platform_net` ignores commission that is owed but not yet transferred.**
   Since the accrual model landed, commission sits as `held` /
   `failed` / `skipped_no_connected_account` rows before payment; the
   dashboard subtracts only `status == 'paid'` transfers, so margin is
   overstated by every accrued-unpaid share (up to 65% of recent sales).
4. **The weekly ops digest reads $0 on one-time-sale weeks** — it sums only
   `payments` (invoice-backed) rows, and one-time products (jobs, featured
   events, sponsored stories, custom) never produce an invoice. If $0 is a
   normal reading, a real revenue stop is invisible.

## Current state

- `apps/web/src/app/api/admin/finance/route.ts` (developer-gated, read-only):
  - lines ~25-27: reads whole `payments` + `ad_purchases` collections.
  - lines ~44-73: maps both into one `incoming` array; the purchase mapping
    is `amount: Number(x.amount_total) || 0`, `status: x.payment_status`.
  - line ~85: `const paidIncoming = incoming.filter((x) => ['paid', 'completed', 'succeeded'].includes(x.status))`
  - line ~89: `const totalPaidOut = outgoing.filter((x) => x.status === 'paid').reduce(...)`.
- `apps/web/src/app/api/cron/ops-digest/route.ts`:
  - line ~48: `const weekPayments = (payments.docs as any[]).map((d) => d.data()).filter((p) => inWindow(p.created_at) && p.status === 'paid')`
  - line ~49: `const revenueCents = weekPayments.reduce((s, p) => s + (p.amount || 0), 0)`.
- `apps/web/src/app/api/stripe/webhook/route.ts` — `handleChargeRefunded(charge)`:
  patches `ad_purchases` (by payment-intent/session), `sales_orders`,
  fulfillment targets, commission clawback. It computes
  `const fullyRefunded = Boolean(charge.refunded) || Number(charge.amount_refunded || 0) >= Number(charge.amount || 0)`
  near the top, and (already, for the sales-orders lookup) retrieves
  `charge.invoice` when present. **It never touches the `payments`
  collection.** `payments` docs are keyed by INVOICE id
  (`recordPayment`: `adminDb.collection('payments').doc(invoice.id)`).
- `ad_purchases` rows carry `stripe_subscription_id` **iff** the purchase
  opened a subscription (verified across all three writers in the webhook:
  the sales-desk branch, the generic branch, and the job/ad provisioning
  branch — the last writes one-time rows with no subscription field).
  Directory sales never write `ad_purchases`. This is what makes the
  dedupe rule in Step 2 sound: *a purchase row with a subscription id is
  always shadowed by its own first invoice in `payments`.*
- Conventions: pure decision logic in `apps/web/src/lib/*` with colocated
  `node:test` tests (exemplar pair: `lib/checkout-recovery.ts` /
  `.test.ts`); routes stay thin.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Lint | `cd apps/web && npm run lint` | clean |
| New tests | `cd apps/web && npx tsx --test src/lib/finance-rollup.test.ts` | pass |
| Suite | `npm test` (root) | 0 failures |
| Build | `cd apps/web && npx next build` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/lib/finance-rollup.ts` (create — pure predicates)
- `apps/web/src/lib/finance-rollup.test.ts` (create)
- `apps/web/src/app/api/stripe/webhook/route.ts` (ONLY: add a `payments`
  patch inside `handleChargeRefunded`)
- `apps/web/src/app/api/admin/finance/route.ts`
- `apps/web/src/app/api/cron/ops-digest/route.ts`

**Out of scope**:
- Commission movement (`payouts.ts`) and clawback logic — untouched.
- Historical backfill of already-refunded rows (none exist at plan time —
  the account has one charge and zero refunds).
- Any UI page — this plan fixes the API numbers.

## Git workflow

Branch `advisor/005-finance-truth`; one emoji-prefixed commit; **do not push**
(push deploys production).

## Steps

### Step 1: Pure rollup rules

Create `apps/web/src/lib/finance-rollup.ts`:

```ts
// Rules that decide what counts as collected revenue. Pure and unit-tested
// because the dashboard was double-counting and never un-counting:
// see finance-rollup.test.ts for the exact regressions pinned.

/** ad_purchases rows that opened a subscription are shadowed by their own
 *  first invoice in `payments` — counting both double-counts month one. */
export function purchaseRowCounts(row: { stripe_subscription_id?: unknown }): boolean {
  return !row.stripe_subscription_id
}

/** Collected cents for a payments/purchase row, net of refunds. A fully
 *  refunded row contributes 0 via its status; a partial refund subtracts. */
export function collectedCents(row: {
  amount?: unknown
  amount_refunded?: unknown
}): number {
  const amount = Math.max(0, Math.round(Number(row.amount) || 0))
  const refunded = Math.max(0, Math.round(Number(row.amount_refunded) || 0))
  return Math.max(0, amount - refunded)
}

export const PAID_STATUSES = ['paid', 'completed', 'succeeded'] as const

/** Commission the platform still owes: accrued or attempted but not paid. */
export const COMMISSION_OWED_STATUSES = ['held', 'failed', 'skipped_no_connected_account'] as const
```

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 2: Refunds unbook the invoice ledger

In `handleChargeRefunded` (webhook), where `charge.invoice` is available (it
is already read for the sales-orders fallback; hoist the retrieved invoice id
if needed), add:

```ts
  // Un-book the invoice ledger. `payments` rows are keyed by invoice id and
  // the finance dashboard counts status 'paid' forever — so a refund used to
  // leave collected-revenue overstated permanently.
  const refundedInvoiceId = stripeObjectId(charge.invoice)
  if (refundedInvoiceId) {
    await adminDb.collection('payments').doc(refundedInvoiceId).set(
      fullyRefunded
        ? { status: 'refunded', refunded_at: now, amount_refunded: Number(charge.amount_refunded || 0) }
        : { amount_refunded: Number(charge.amount_refunded || 0), updated_at: now },
      { merge: true }
    ).catch(() => {})
  }
```

Place it beside the existing `ad_purchases` patch so all ledgers are updated
together. `now` (ISO string) and `stripeObjectId` already exist in scope.

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 3: Finance route uses the rules

In `api/admin/finance/route.ts`:
1. Import the four exports from `@/lib/finance-rollup`.
2. Purchases mapping: drop rows where `!purchaseRowCounts(x)` (filter before
   mapping).
3. Wherever a paid row's `amount` is summed (`totalIncoming`, `byMonth`
   incoming), use `collectedCents(x)` so partial refunds subtract. Replace the
   inline `['paid','completed','succeeded']` literal with `PAID_STATUSES`.
4. Add owed-commission visibility, computed from the ALREADY-FETCHED
   `transfersSnap`:

```ts
    const commissionOwed = outgoing
      .filter((x) => (COMMISSION_OWED_STATUSES as readonly string[]).includes(x.status))
      .reduce((s, x) => s + (x.amount || 0), 0)
    const commissionOwedBack = outgoing
      .filter((x) => x.status === 'clawback_owed')
      .reduce((s, x) => s + (x.amount || 0), 0)
```

   and include in the response: `total_commission_owed: commissionOwed`,
   `commission_owed_back: commissionOwedBack`, and
   `platform_net_after_owed: <existing net> - commissionOwed`. Do not rename
   any existing response field — the finance page reads them.

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 4: Ops digest counts one-time sales

In `api/cron/ops-digest/route.ts`, alongside `weekPayments`:

```ts
    const purchases = await adminDb.collection('ad_purchases').get().catch(() => ({ docs: [] as any[] }))
    const weekOneTime = (purchases.docs as any[])
      .map((d) => d.data())
      .filter((p) => inWindow(p.created_at) && p.payment_status === 'completed' && purchaseRowCounts(p))
    const revenueCents = weekPayments.reduce((s, p) => s + collectedCents(p), 0)
      + weekOneTime.reduce((s, p) => s + (Number(p.amount_total) || 0), 0)
```

(Adjust the existing `revenueCents` line rather than declaring twice.) Update
the digest row label from `'paid invoices'` to `'invoices + one-time sales'`.

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 5: Tests

Create `apps/web/src/lib/finance-rollup.test.ts` (register in the ROOT
`package.json` `"test"` list — the module has no `@/` or firebase imports):

1. `purchaseRowCounts`: `{stripe_subscription_id: 'sub_1'}` → false (the
   double-count regression); `{}` / `{stripe_subscription_id: null}` → true.
2. `collectedCents`: plain amount; partial refund subtracts; full refund → 0;
   garbage/negative inputs → 0; refund larger than amount → 0.
3. `COMMISSION_OWED_STATUSES` includes exactly held / failed /
   skipped_no_connected_account (pins that `reversed`, `clawback_owed`,
   `paid`, `skipped_invalid` are NOT owed).

**Verify**: `npm test` (root) → 0 failures with the new tests counted.

### Step 6: Full verification

Typecheck, lint, suite, build — clean.

## Test plan

Step 5. The webhook/routes remain I/O-thin consumers of the tested rules;
this repo deliberately has no mock-Firestore harness (tracked separately in
`plans/README.md` as an unplanned finding).

## Done criteria

- [ ] Refunding a charge with an invoice patches `payments/<invoiceId>`
- [ ] Finance: subscription-backed purchase rows excluded; partial refunds
      subtract; `total_commission_owed`, `commission_owed_back`,
      `platform_net_after_owed` present; no existing field renamed
- [ ] Ops digest revenue includes windowed one-time `ad_purchases`
- [ ] `finance-rollup.test.ts` exists, registered at root, passing
- [ ] Typecheck/lint/suite/build clean; `plans/README.md` updated

## STOP conditions

- `payments` docs are no longer keyed by invoice id (check `recordPayment`).
- The finance route's `incoming`/`outgoing` construction has been rewritten
  (line anchors gone) — re-map before editing.
- Any existing response field would need renaming to proceed — report instead.

## Maintenance notes

- Future products that create BOTH a purchase row and invoices must carry
  `stripe_subscription_id` on the purchase row, or they will double-count —
  state this in code review for any new webhook fulfillment branch.
- `platform_net_after_owed` is the honest margin; consider surfacing it in
  the finance UI (deferred — API-only here).
- The full-collection reads in finance/ops-digest are fine at current volume
  but are listed as a scaling follow-up in `plans/README.md`.
