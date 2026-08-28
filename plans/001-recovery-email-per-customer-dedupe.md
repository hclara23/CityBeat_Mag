# Plan 001: Make abandoned-checkout recovery safe to switch on (dedupe per customer, not per order)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/lib/checkout-recovery.ts apps/web/src/lib/checkout-recovery.test.ts apps/web/src/app/api/cron/checkout-recovery/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (blocks a revenue feature)
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

The live Stripe account shows 18 checkout sessions and exactly 1 payment: eight
real local businesses received a payment link, let it expire, and were never
followed up with. A recovery cron already exists and is deployed
(`/api/cron/checkout-recovery`): it marks lapsed orders `expired` (always) and
can email the customer one polite nudge (currently OFF via
`CHECKOUT_RECOVERY_EMAILS`). The sends stay off because of one known defect:
**the "one nudge ever" rule is enforced per ORDER, not per CUSTOMER.** Two real
consequences, visible in the production dry run: the same contact
(`mandomar49@gmail.com`) holds two abandoned orders and would receive two
emails; and a customer whose rep re-issued a fresh link (the Sales Desk's
"Correct details" flow creates a new order) and who then PAID on the new order
would still be emailed "your payment link expired — still interested?" for the
old one. Fixing the dedupe makes the feature safe for the operator to enable,
which is the single largest recoverable-revenue item in the audit.

## Current state

- `apps/web/src/lib/checkout-recovery.ts` — pure logic (no I/O), fully unit-tested. Key excerpt (lines 59–90):

```ts
export function isRecoverable(
  order: Record<string, unknown>,
  now: Date | string = new Date()
): boolean {
  if (checkoutLinkState(order, now) !== 'expired') return false
  if (order.recovery_emailed_at) return false
  if (typeof order.contact_email !== 'string' || !order.contact_email.includes('@')) return false

  const nowMs = new Date(now).getTime()
  const reference = parseTime(order.checkout_expires_at) ?? parseTime(order.created_at)
  if (reference === null) return false
  return nowMs - reference <= RECOVERY_WINDOW_DAYS * 86400000
}

/** Split a batch into what to mark expired and what to actually email. */
export function planRecovery(
  orders: Array<{ id: string } & Record<string, unknown>>,
  now: Date | string = new Date()
): {
  toExpire: string[]
  toEmail: Array<{ id: string } & Record<string, unknown>>
} {
  const toExpire: string[] = []
  const toEmail: Array<{ id: string } & Record<string, unknown>> = []
  for (const order of orders) {
    if (checkoutLinkState(order, now) !== 'expired') continue
    // Only rewrite rows still claiming to be live, so the marker is idempotent.
    if (order.checkout_status !== 'expired') toExpire.push(order.id)
    if (isRecoverable(order, now)) toEmail.push(order)
  }
  return { toExpire, toEmail }
}
```

- `apps/web/src/app/api/cron/checkout-recovery/route.ts` — the cron. It
  queries ONLY unpaid orders (`.where('payment_status', '==', 'pending')`,
  around line 46), calls `planRecovery`, marks `toExpire`, and (only when
  `?send=1` or `CHECKOUT_RECOVERY_EMAILS === 'on'`, lines 36–38) emails
  `toEmail` and stamps `recovery_emailed_at` per order (line ~101). Because it
  never fetches PAID orders, it cannot currently know that a customer already
  converted on a sibling order.
- `apps/web/src/lib/checkout-recovery.test.ts` — 7 tests, `node:test` style.
  This is the structural pattern to extend.
- Convention: business logic lives in pure functions in `apps/web/src/lib/`,
  I/O stays in the route; tests are colocated `*.test.ts` run with
  `tsx --test`. Match `checkout-recovery.ts` itself — it is the exemplar.
- Firestore fields on a `sales_orders` doc you will rely on:
  `contact_email` (string), `payment_status` (`'pending' | 'paid'`),
  `recovery_emailed_at` (ISO string, set only after a confirmed send).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0, no output |
| Lint | `cd apps/web && npm run lint` | `✔ No ESLint warnings or errors` |
| This module's tests | `cd apps/web && npx tsx --test src/lib/checkout-recovery.test.ts` | all pass |
| Full suite | `npm test` (repo root) | 0 failures (192 root + 27 app-scoped at plan time) |
| Build | `cd apps/web && npx next build` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/lib/checkout-recovery.ts`
- `apps/web/src/lib/checkout-recovery.test.ts`
- `apps/web/src/app/api/cron/checkout-recovery/route.ts`

**Out of scope** (do NOT touch):
- Any Cloud Scheduler / env-var change. Enabling `CHECKOUT_RECOVERY_EMAILS`
  is an OPERATOR decision — this plan only makes it safe. Do not create a
  scheduler job, do not set the env var, do not pass `?send=1` anywhere.
- `apps/web/src/lib/email.ts` and the email copy in `recoveryEmail` — the
  bilingual copy is deliberate (invites a reply, contains no dead payment
  link). Leave it.
- The Sales Desk UI (`sales/me/page.tsx`) — it already renders link state.

## Git workflow

- Branch: work directly on `main` ONLY if the operator says so; default
  `advisor/001-recovery-dedupe`. **Do NOT push** — pushing `main` auto-deploys
  to production via GitHub Actions in this repo.
- Commit style: single commit, emoji-prefixed subject line matching repo
  history (see `git log --oneline -5`), e.g.
  `🔧 Recovery nudges dedupe per customer and skip converted buyers`.

## Steps

### Step 1: Extend `planRecovery` with a customer-level exclusion

In `apps/web/src/lib/checkout-recovery.ts`, change `planRecovery` to accept an
options argument and dedupe `toEmail` by normalized email:

```ts
export function planRecovery(
  orders: Array<{ id: string } & Record<string, unknown>>,
  now: Date | string = new Date(),
  opts: { excludeEmails?: Iterable<string> } = {}
): { toExpire: string[]; toEmail: Array<{ id: string } & Record<string, unknown>> }
```

Behavior (all inside the pure function — no I/O):
1. Build `const excluded = new Set([...(opts.excludeEmails ?? [])].map(normalize))`
   where `normalize` is `(e) => String(e).trim().toLowerCase()`.
2. `toExpire` logic is UNCHANGED (marking a dead link is per order and safe).
3. For `toEmail`: skip any order whose normalized `contact_email` is in
   `excluded`; and dedupe within the batch — the FIRST eligible order per
   normalized email wins, later ones are skipped.

Also treat an order's own siblings: if any order **in the input batch** with
the same normalized email has `payment_status === 'paid'` or
`checkout_status === 'completed'` or a truthy `recovery_emailed_at`, exclude
that email entirely (the customer already converted or was already nudged).

**Verify**: `cd apps/web && npx tsx --test src/lib/checkout-recovery.test.ts`
→ existing 7 tests still pass (the new argument is optional; no call-site
breaks).

### Step 2: Feed the exclusion set from the cron

In `apps/web/src/app/api/cron/checkout-recovery/route.ts`:

1. Alongside the existing `pending` query, fetch converted customers:
   ```ts
   const paidSnap = await adminDb
     .collection('sales_orders')
     .where('payment_status', '==', 'paid')
     .limit(500)
     .get()
   const excludeEmails = paidSnap.docs
     .map((d) => (d.data() as any).contact_email)
     .filter((e: any) => typeof e === 'string' && e.includes('@'))
   ```
2. Pass it: `planRecovery(orders, now, { excludeEmails })`.
3. In the dry-run JSON response, add `excluded_converted: excludeEmails.length`
   so the operator can see the guard working before enabling sends.

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 3: Tests

Add to `apps/web/src/lib/checkout-recovery.test.ts` (model on the existing
`planRecovery separates marking...` test):

1. Two expired orders, same `contact_email` (case-varied: `A@b.com` /
   `a@B.com`) → `toEmail` has exactly 1 entry; `toExpire` has 2.
2. Expired order for `x@y.com` + a PAID order for `X@Y.com ` (note whitespace)
   in the same batch → `toEmail` is empty for that customer.
3. `excludeEmails: ['done@biz.com']` option removes that customer's expired
   order from `toEmail` but NOT from `toExpire`.
4. A sibling with `recovery_emailed_at` set suppresses a second email to the
   same customer's other order.

**Verify**: `cd apps/web && npx tsx --test src/lib/checkout-recovery.test.ts`
→ 11 tests pass (7 existing + 4 new).

### Step 4: Full verification

**Verify**, in order:
- `cd apps/web && npx tsc --noEmit` → exit 0
- `cd apps/web && npm run lint` → no warnings/errors
- `npm test` (repo root) → 0 failures
- `cd apps/web && npx next build` → exit 0

## Test plan

Covered in Step 3. Pattern file: `apps/web/src/lib/checkout-recovery.test.ts`
(same file). No route-level test exists in this repo for crons; the route
change is 6 lines and is verified by typecheck + the dry-run field.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0; 4 new dedupe tests exist and pass
- [ ] `planRecovery` third parameter is optional (existing two-arg calls compile)
- [ ] The cron's dry-run response includes `excluded_converted`
- [ ] `git status` shows changes ONLY in the three in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `planRecovery` excerpt above doesn't match the live code (drifted).
- The cron route no longer queries `payment_status == 'pending'` (its shape
  changed underneath this plan).
- You find yourself wanting to enable sends, alter email copy, or touch the
  scheduler — that is operator territory; stop and report instead.
- Full-suite failures unrelated to your change persist after re-running once.

## Maintenance notes

- When the operator enables sends, first run
  `GET /api/cron/checkout-recovery?dryRun=1` (with the cron bearer header) and
  review `recipients` + `excluded_converted` by hand.
- If sales volume grows past ~500 paid orders, the exclusion query's `limit(500)`
  needs a cursor or a per-customer flag; note this in that future change.
- Future feature that would interact: a second-touch drip. The current design
  is deliberately ONE nudge per customer, ever — extend `recovery_emailed_at`
  semantics rather than removing the guard.
