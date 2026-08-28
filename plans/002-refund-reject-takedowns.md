# Plan 002: A refund or rejection actually takes the paid content down

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/lib/events.ts apps/web/src/app/api/admin/jobs/route.ts apps/web/src/app/api/stripe/webhook/route.ts "apps/web/src/app/[locale]/jobs/page.tsx"`
> On any in-scope drift, compare "Current state" excerpts to the live code;
> mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

Two confirmed defects make reversals cosmetic:

1. **A refunded Featured Event gets PUBLISHED.** The public events reader hides
   events with a deny-list (`status !== 'pending' && status !== 'rejected'`).
   The Stripe webhook's refund path stamps non-directory fulfillment targets
   with `status: 'needs_attention'` — which passes the deny-list. A refunded
   paid event therefore becomes publicly visible, and because paid events carry
   `featured: true`, it sorts to the top of /events.
2. **A refunded or admin-rejected job posting stays on the public board for its
   full 30 days.** The board queries `is_paid == true AND expires_at > now`.
   Rejection writes `status: 'rejected', is_active: false`; refund writes
   `status: 'needs_attention', is_active: false`. Neither touches `is_paid` or
   `expires_at`, so the board keeps rendering the posting.

Both are reputational and paid-content-integrity problems: a scam takedown or
goodwill refund currently leaves (or worse, promotes) the content.

## Current state

- `apps/web/src/lib/events.ts:16-20` — the deny-list:

```ts
// Visible to the public = approved, or legacy events with no status set.
// Pending (community-submitted, awaiting review) and rejected are hidden.
function isVisible(e: any): boolean {
  return e.status !== 'pending' && e.status !== 'rejected'
}
```

`isVisible` is used at lines ~28, ~72, ~89 of the same file (list, weekend
list, and single-event fetch).

- **Every writer of `events.status` (verified exhaustively at plan time):**
  `api/cron/sync-events` writes `'approved'`; `api/events/submit` writes
  `'pending'`; `api/admin/events` writes `'approved'` or `'rejected'`;
  the webhook `event_feature` branch (line ~283) writes `'approved'`;
  the webhook refund path writes `'needs_attention'`; Sales-Desk fulfillment
  (`lib/sales-fulfillment.ts`, `event` case) writes `'pending'`. Legacy rows
  may have no status at all. **Therefore an allow-list
  (`!e.status || e.status === 'approved'`) changes visibility ONLY for
  `'needs_attention'` and unknown/garbage values — exactly the intent.**

- `apps/web/src/app/[locale]/jobs/page.tsx:25-30` — the public board query:

```ts
const jobsSnapshot = await adminDb.collection('jobs')
  .where('is_paid', '==', true)
  .where('expires_at', '>', new Date().toISOString())
  .orderBy('expires_at', 'desc')
  .orderBy('created_at', 'desc')
  .get()
```

There is a composite index for exactly `(is_paid ASC, expires_at DESC,
created_at DESC)` in `firestore.indexes.json`. **Do not add fields to this
query** — that would require a new index deploy. Take rejected/refunded jobs
off the board by expiring them instead.

- `apps/web/src/app/api/admin/jobs/route.ts:~66-72` — reject branch currently:
  `{ is_active: false, status: 'rejected', moderated_by, moderated_at, updated_at }`.

- `apps/web/src/app/api/stripe/webhook/route.ts:~646-668` — refund
  fulfillment-target patch; the non-directory arm is
  `: { status: 'needs_attention', is_active: false }`. The surrounding
  directory arm was recently reworked (isOriginatingCharge guard) — do not
  touch it.

- Repo conventions: heavy "why" comments at change sites explaining the bug
  being prevented (see the directory arm right above your edit for the house
  style); pure logic in `lib/` with colocated `node:test` tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Lint | `cd apps/web && npm run lint` | `✔ No ESLint warnings or errors` |
| Full suite | `npm test` (repo root) | 0 failures |
| Build | `cd apps/web && npx next build` | exit 0 |

## Scope

**In scope**:
- `apps/web/src/lib/events.ts` (isVisible → allow-list; export it for testing)
- `apps/web/src/lib/events-visibility.test.ts` (create)
- `apps/web/src/app/api/admin/jobs/route.ts` (reject branch)
- `apps/web/src/app/api/stripe/webhook/route.ts` (ONLY the non-directory arm
  of the refund target patch — add a jobs-specific expiry)

**Out of scope**:
- The jobs board query and `firestore.indexes.json` — keep index-free.
- The directory arm of the refund patch (recently fixed; guarded by
  `isOriginatingCharge`).
- `api/admin/events` approve/reject flow (already writes correct statuses).
- Restoring content when a dispute is WON — deliberate manual decision.

## Git workflow

- Branch `advisor/002-refund-takedowns`; single emoji-prefixed commit
  (match `git log --oneline -5` style). **Do not push** (push = production
  deploy in this repo).

## Steps

### Step 1: Flip events visibility to an allow-list

In `apps/web/src/lib/events.ts` replace the function and EXPORT it:

```ts
// Visible to the public = explicitly approved, or a legacy event predating
// the status field. This is an ALLOW-list on purpose: the old deny-list
// (status !== 'pending' && status !== 'rejected') let every unknown status
// through — including 'needs_attention', which the Stripe refund path stamps
// on a refunded paid event. A refund was therefore PUBLISHING the event, and
// featured:true then pinned it to the top of /events.
export function isEventVisible(e: { status?: unknown }): boolean {
  return !e.status || e.status === 'approved'
}
```

Update the three internal call sites from `isVisible` to `isEventVisible`
(keep a `const isVisible = isEventVisible` alias if that is smaller).

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 2: Rejecting a job takes it off the board

In `apps/web/src/app/api/admin/jobs/route.ts`, extend the reject branch:

```ts
: {
    is_active: false,
    status: 'rejected',
    // The public board filters on expires_at > now (index-backed) and never
    // reads status/is_active — so a rejected posting used to stay listed for
    // its full 30 days. Expiring it is the index-free takedown.
    expires_at: now,
    moderated_by: auth.user.id,
    moderated_at: now,
    updated_at: now,
  }
```

(`now` is already an ISO string in this handler.)

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 3: Refunding a job takes it off the board

In the webhook's refund target patch, change the non-directory arm to also
expire jobs:

```ts
: {
    status: 'needs_attention',
    is_active: false,
    // Jobs: the public board filters ONLY on is_paid + expires_at, so
    // deactivating is not a takedown — expire it too.
    ...(target.collection === 'jobs' ? { expires_at: now } : {}),
  }
```

`now` is already defined as an ISO string in `handleChargeRefunded`.

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 4: Tests

Create `apps/web/src/lib/events-visibility.test.ts` (pattern:
`apps/web/src/lib/checkout-recovery.test.ts`; `node:test` + `assert/strict`):

1. `isEventVisible({})` and `{status: undefined}` → true (legacy).
2. `{status: 'approved'}` → true.
3. `{status: 'pending'}`, `{status: 'rejected'}` → false.
4. **The regression**: `{status: 'needs_attention'}` → false.
5. Garbage: `{status: 'zzz'}` → false.

Register the file in the ROOT `package.json` `"test"` list (it has no `@/`
imports, so root execution is fine — `lib/events.ts` imports only
firebase admin via `@citybeat/lib/...`? **Check first**: if
`lib/events.ts` imports `@/` or `@citybeat/lib/firebase/admin` at module
scope, put the test in the app-scoped script
(`"test:scrapeflow"` list in root `package.json`) instead — that is the
established workaround for alias-resolution from the repo root.)

**Verify**: `npm test` (root) → 0 failures, new tests counted.

### Step 5: Full verification

`npx tsc --noEmit`, `npm run lint`, `npm test`, `npx next build` — all clean.

## Test plan

Step 4. Route-level behavior (steps 2–3) is data-shape only and covered by
typecheck; the visibility rule — where the real regression lived — is pinned
by unit tests.

## Done criteria

- [ ] `grep -n "status !== 'pending'" apps/web/src/lib/events.ts` → no matches
- [ ] New visibility tests exist and pass; full suite 0 failures
- [ ] Reject branch writes `expires_at`; webhook jobs arm writes `expires_at`
- [ ] `git status` — only in-scope files changed
- [ ] `plans/README.md` row updated

## STOP conditions

- Any additional writer of `events.status` exists that is not in the
  "every writer" list above (search `collection('events')` before Step 1;
  a new status value means the allow-list needs review).
- The jobs board query has changed shape (e.g. now filters `is_active`).
- The webhook refund patch no longer contains the
  `: { status: 'needs_attention', is_active: false }` arm verbatim.

## Maintenance notes

- Anyone adding a NEW events status must add it to the allow-list explicitly —
  that is the point of the design; mention it in the PR description.
- If a takedown-reversal flow is ever built (dispute won), it must restore
  `expires_at` from `published_at + 30d`, not from "now".
- The `needs_attention` status remains the operator's review signal in the
  admin events screen; hiding it publicly does not remove it from admin lists.
