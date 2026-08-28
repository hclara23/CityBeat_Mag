# Plan 003: Sales Desk bills multi-location listings per location, matching self-serve

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. On
> any STOP condition, stop and report. When done, update your row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/app/api/sales/checkout/route.ts apps/web/src/lib/sales-checkout.ts apps/web/src/lib/sales-orders.ts apps/web/src/lib/sales-checkout.test.ts`
> Mismatch with "Current state" excerpts = STOP.

## Status

- **Priority**: P1
- **Effort**: M (S code, M care — it changes charge amounts)
- **Risk**: MED — a mistake here changes what real customers are charged
- **Depends on**: none
- **Category**: bug (revenue)
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

Directory listings can be multi-location: the ScrapeFlow consolidation merges
same-brand rows into one card with `location_count` locations, and the pricing
policy (CLAUDE.md: "Multi-location brands are billed PER LOCATION") multiplies
the plan fee accordingly. Self-serve checkout implements this. **The Sales Desk
does not** — a rep selling the same 6-location brand charges for 1 location
($19.99 instead of $119.94/mo), and commission (computed from the session
total) shrinks by the same factor. Two checkout paths quote different prices
for the same product; the discounted one is the one with a salesperson in the
room. This is direct revenue loss on exactly the deals reps chase (multi-location
brands are the biggest local advertisers).

## Current state

- Self-serve (the behavior to match), `apps/web/src/app/api/directory/claim/route.ts:134-136,156,182`:

```ts
const locationCount = Math.max(1, Number(listing.location_count) || 1)
const perLocationNote =
  locationCount > 1 ? ` — ${locationCount} locations × ${plan.priceLabel}` : ''
...
location_count: String(locationCount),   // checkout metadata
...
quantity: locationCount,                  // Stripe line item
```

- Sales Desk, `apps/web/src/app/api/sales/checkout/route.ts`:
  - line ~120: `const amount = salesProductAmount(product, body.amount)` —
    per-unit cents from the server-owned catalog.
  - lines ~388-393 (inside `stripe.checkout.sessions.create`):

```ts
{
  quantity: 1,
  price_data: {
    currency: 'usd',
    unit_amount: amount,
    ...
```

  - A pre-existing listing is loaded earlier via `existingDirectoryListing(...)`
    into `listing` (a `Record<string, unknown> | null`); its
    `location_count` field is available but unused.
  - The order record stores `amount: input.amount`
    (`apps/web/src/lib/sales-orders.ts:~67`, `buildSalesOrderRecord`).

- **The money-critical validation you must keep satisfied** —
  `apps/web/src/app/api/stripe/webhook/route.ts:116`:

```ts
if (session.amount_subtotal != null && Number(session.amount_subtotal) !== Number(order.amount)) {
  throw new Error('Stripe Session subtotal does not match the server-priced sales order.')
}
```

`session.amount_subtotal` = `unit_amount × quantity`. So if quantity becomes
`locationCount`, **`order.amount` must store the TOTAL** (unit × locations),
or every multi-location payment will throw at fulfillment time and the
customer will be charged without being fulfilled.

- Known readers of `order.amount` (verified at plan time): the webhook
  validation above (needs TOTAL after this change); `/api/sales/me`
  (`amount: data.amount_paid ?? data.amount ?? 0` — displays deal value, TOTAL
  is correct there); `salesProductPriceLabel(product, amount)` in the
  checkout response (for fixed-price products it ignores the amount argument
  and returns the catalog label — unchanged behavior). Re-grep before editing:
  `grep -rn "order.amount\|\.amount ?? " apps/web/src --include=*.ts | grep -i sales`.

- Conventions: money decisions live in pure functions in `apps/web/src/lib/`
  with colocated tests (`sales-checkout.ts` + `sales-checkout.test.ts` is the
  exemplar pair for exactly this kind of logic).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Lint | `cd apps/web && npm run lint` | clean |
| Targeted tests | `npx tsx --test apps/web/src/lib/sales-checkout.test.ts` (from repo root) | pass |
| Full suite | `npm test` | 0 failures |
| Build | `cd apps/web && npx next build` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/lib/sales-checkout.ts` (new pure helper)
- `apps/web/src/lib/sales-checkout.test.ts` (tests)
- `apps/web/src/app/api/sales/checkout/route.ts` (use the helper)

**Out of scope**:
- `apps/web/src/app/api/sales/partner/route.ts` — the partner API quotes
  catalog prices for NEW businesses (no pre-existing listing ⇒ no
  location_count); leave it.
- `apps/web/src/app/api/directory/claim/route.ts` — already correct.
- The webhook — its validation must keep working UNCHANGED; if you feel the
  need to edit it, you've broken the total-vs-unit contract (STOP).
- Refunds/commission — they key off Stripe session totals and follow automatically.

## Git workflow

Branch `advisor/003-multi-location-parity`; one emoji-prefixed commit; **do
not push** (push auto-deploys production).

## Steps

### Step 1: Pure helper

In `apps/web/src/lib/sales-checkout.ts` add:

```ts
/**
 * Locations a directory subscription bills for. Multi-location brands are
 * billed PER LOCATION (the consolidation writes location_count); every other
 * product — and a net-new single listing — bills exactly one unit. Mirrors
 * the self-serve rule in api/directory/claim so the two checkout paths can
 * never quote different prices for the same listing.
 */
export function directoryBillingQuantity(input: {
  productFamily: string
  billing: string
  listing: Record<string, unknown> | null
}): number {
  if (input.productFamily !== 'directory' || input.billing !== 'subscription') return 1
  const count = Number(input.listing?.location_count)
  return Number.isFinite(count) && count > 1 ? Math.floor(count) : 1
}
```

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 2: Wire it into the Sales Desk checkout

In `apps/web/src/app/api/sales/checkout/route.ts`, after `listing` is loaded
and `amount` computed:

```ts
const billingQuantity = directoryBillingQuantity({
  productFamily: product.family,
  billing: product.billing,
  listing,
})
// The order stores the TOTAL: the webhook validates
// session.amount_subtotal (= unit × quantity) against order.amount, and a
// mismatch fails fulfillment for a customer who has already paid.
const amountTotal = amount * billingQuantity
```

Then:
1. Pass `amountTotal` (not `amount`) into `buildSalesOrderRecord`.
2. In the Stripe line item: `quantity: billingQuantity`, keep
   `unit_amount: amount`.
3. When `billingQuantity > 1`, append the self-serve-style note to
   `product_data.name`: `` ` — ${billingQuantity} locations × ${product.priceLabel}` ``.
4. Add `location_count: String(billingQuantity)` to the checkout `metadata`
   object (both session and subscription metadata use the same object).

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 3: Tests

In `apps/web/src/lib/sales-checkout.test.ts` add a test block (match the
file's existing style):

1. Non-directory product → 1, whatever the listing says.
2. Directory subscription, listing `{location_count: 6}` → 6.
3. Directory subscription, `location_count` absent / 1 / 0 / NaN / `'6'`
   (string) → handled: absent/1/0/NaN → 1; numeric-string coerces → 6.
4. Net-new (listing `null`) → 1.
5. Free product (`billing: 'free'`) → 1.

**Verify**: `npx tsx --test apps/web/src/lib/sales-checkout.test.ts` → all pass.

### Step 4: Full verification

Typecheck, lint, `npm test`, build — all clean.

## Test plan

Step 3, in the existing exemplar test file. The route wiring is verified by
typecheck plus the invariant test (order total = unit × quantity) implicitly
exercised through `buildSalesOrderRecord` inputs.

## Done criteria

- [ ] `directoryBillingQuantity` exists, exported, tested (≥5 cases)
- [ ] Sales checkout line item uses `quantity: billingQuantity`
- [ ] `buildSalesOrderRecord` receives the TOTAL amount
- [ ] Checkout metadata carries `location_count`
- [ ] Webhook file untouched (`git diff --stat` shows no webhook change)
- [ ] Full suite + build clean; `plans/README.md` updated

## STOP conditions

- The webhook validation at line ~116 no longer compares
  `session.amount_subtotal` to `order.amount` (contract changed — re-derive
  where the total must live before proceeding).
- You find another reader of `order.amount` that treats it as PER-UNIT
  (the re-grep in "Current state"); report it instead of guessing.
- `existingDirectoryListing` no longer returns the listing record.

## Maintenance notes

- The rep-facing desk UI does not yet SHOW the multiplied price before link
  generation; the Stripe checkout page and product name do. A follow-up could
  surface `billingQuantity` in the `/api/sales/checkout` JSON response for the
  desk to display — deliberately deferred (display-only).
- If per-location pricing ever gets tiered (e.g. volume discount), the rule
  belongs in `directoryBillingQuantity`'s caller via the catalog, not in the
  helper.
- Watch in review: no change to custom_one_time behavior (its amount is the
  manager-approved total already; family `custom` returns quantity 1).
