# Plan 004: Payout cycle pages by eligibility; no matured commission is ever silently skipped

> **Executor instructions**: Follow this plan step by step, run every
> verification, honor every STOP condition. Update your row in
> `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/lib/payouts.ts firestore.indexes.json apps/web/src/app/api/cron/payout-cycle/route.ts`
> Mismatch with the excerpts below = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — this loop moves real money twice a month
- **Depends on**: none (but see the OPERATOR STEP in Done criteria — an index
  deploy must precede the code reaching production)
- **Category**: bug (money_not_paid)
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

Commission accrues into the `transfers` collection as `status: 'held'` and is
paid on the 1st and 15th by `runPayoutCycle`. The current scan is
`where('status','==','held').limit(200)` with **no ordering and no
eligibility filter**: not-yet-matured rows consume the 200-row budget, and
above 200 held rows a Firestore-doc-id-determined subset is scanned forever
while the rest — including matured, owed commission — is never examined. The
run then reports success regardless, so nobody is told. This is not
hypothetical growth: the live account has `commission_mode: 'residual'`, which
accrues a NEW share on **every renewal invoice** of every active
subscription, so held-row volume grows with the subscriber base, not with new
sales. Separately, rows with `amount <= 0` or missing payees are `continue`d
without any state change and re-scanned every cycle forever.

## Current state

- `apps/web/src/lib/payouts.ts` — `runPayoutCycle`, scan at lines ~513-519:

```ts
  const snap = await adminDb
    .collection('transfers')
    .where('status', '==', 'held')
    .limit(limit)
    .get()
    .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
```

  Inside the loop: `if (!isCommissionDue(row, now)) continue` (immature rows
  burn budget), then `if (!payeeUserId || !service || amount <= 0) continue`
  (malformed rows burn budget forever), then a fresh re-read guard
  (`status !== 'held'` abort) added recently — KEEP that guard.

- `reconcileFailedTransfers` (same file, ~line 690+) queries `failed` and
  `skipped_no_connected_account` in two separate `limit(limit)` reads —
  already retires malformed rows to `'skipped_invalid'` (that pattern is the
  exemplar for the cycle's retirement step). Its windows can still be pinned
  by rows that will never succeed; this plan adds visibility, not auto-retirement.

- `firestore.indexes.json` (repo root) — currently 3 composite indexes
  (`jobs`, `directory_listings` ×2). None on `transfers`. The new query in
  Step 1 (equality on `status` + range/order on `eligible_at`) **requires**:

```json
{
  "collectionGroup": "transfers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "eligible_at", "order": "ASCENDING" }
  ]
}
```

- Legacy rows: shares that predate the accrual model have **no
  `eligible_at`** — an eligibility-filtered query will never return them.
  At plan time exactly one such row exists and it is already `paid`
  (`tr_3U72lqDBCgtcnBrq1lKCaKH9`); `held`-status legacy rows do not exist.
  Still, Step 1's fallback covers the theoretical case.

- `lib/alerts.ts` exports `reportFailure(source, error, context)` — the
  ops-alert convention (email + `system_alerts`, deduped 3/6h per source).

- Cron caller: `apps/web/src/app/api/cron/payout-cycle/route.ts` passes
  `limit` (default 200) and returns the summary JSON; it already
  `reportFailure`s on throw. Cycle-day gating (1st/15th, `?force=1`) is
  in the route — do not move it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Lint | `cd apps/web && npm run lint` | clean |
| Suite | `npm test` (root) | 0 failures |
| Build | `cd apps/web && npx next build` | exit 0 |
| Index JSON is valid | `python -m json.tool firestore.indexes.json` | parses |

## Scope

**In scope**:
- `apps/web/src/lib/payouts.ts` — `runPayoutCycle` only
- `firestore.indexes.json`
- `apps/web/src/app/api/cron/payout-cycle/route.ts` — surface new summary fields

**Out of scope**:
- `executeTransfer`, `clawbackCommission`, `payoutSplit`, `manualPayout` —
  recently hardened; do not touch.
- `reconcileFailedTransfers` — pinning there is real but deliberately deferred
  (its windows clear as payees onboard; auto-retiring owed money needs an
  operator decision). Do NOT edit it in this plan.
- Deploying the Firestore index — OPERATOR STEP, not executor.
- `lib/commission-schedule.ts` — the schedule rules are correct and tested.

## Git workflow

Branch `advisor/004-payout-cycle-paging`; one emoji-prefixed commit; **do not
push** (push deploys production, and the index must be deployed first — see
Done criteria).

## Steps

### Step 1: Eligibility-filtered, ordered, paged scan with a safe fallback

Replace the single read in `runPayoutCycle` with a paged loop:

```ts
  const nowIso = now.toISOString()
  let processedDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
  let indexedQueryWorked = true
  try {
    // Oldest-eligible first, so a growing backlog can never starve a matured
    // share: every run drains from the front of the eligibility queue.
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null
    while (processedDocs.length < limit) {
      let q = adminDb
        .collection('transfers')
        .where('status', '==', 'held')
        .where('eligible_at', '<=', nowIso)
        .orderBy('eligible_at', 'asc')
        .limit(Math.min(200, limit - processedDocs.length))
      if (cursor) q = q.startAfter(cursor)
      const page = await q.get()
      if (page.empty) break
      processedDocs.push(...page.docs)
      cursor = page.docs[page.docs.length - 1]
      if (page.docs.length < 200) break
    }
  } catch (error) {
    // The composite (status, eligible_at) index may not be deployed yet.
    // Fall back to the old unordered scan so payouts NEVER halt on an index
    // gap — but tell ops, because the fallback can starve above `limit` rows.
    indexedQueryWorked = false
    await reportFailure('payout-cycle-index', error, { hint: 'deploy firestore.indexes.json (transfers status+eligible_at)' }).catch(() => {})
    const snap = await adminDb.collection('transfers').where('status', '==', 'held').limit(limit).get()
    processedDocs = snap.docs
  }
```

Keep the per-row body, with two changes:
1. The `isCommissionDue` check STAYS (defense in depth — the fallback path and
   clock skew both need it) but immature rows no longer consume budget on the
   indexed path (they aren't returned).
2. Replace the silent-`continue` for malformed rows with retirement, matching
   `reconcileFailedTransfers`' `skipped_invalid` pattern:

```ts
    if (!payeeUserId || !service || amount <= 0) {
      if (!dryRun) await doc.ref.set({ status: 'skipped_invalid' }, { merge: true }).catch(() => {})
      summary.invalid++
      continue
    }
```

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 2: Truncation is loud

Extend the summary type with `invalid: number`, `truncated: boolean`,
`indexed: boolean`. Set `truncated = processedDocs.length >= limit` and, when
true and not dryRun:

```ts
    await reportFailure(
      'payout-cycle-truncated',
      new Error(`Payout cycle hit its ${limit}-row window with matured shares possibly remaining — run again or raise ?limit=`),
      { scanned: processedDocs.length }
    ).catch(() => {})
```

Surface all three fields through the route's JSON response (it spreads the
summary already — verify the spread, don't duplicate keys).

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step 3: Index JSON

Append the `transfers (status ASC, eligible_at ASC)` block from "Current
state" to the `indexes` array in `firestore.indexes.json`.

**Verify**: `python -m json.tool firestore.indexes.json` → parses; the array
has 4 entries.

### Step 4: Full verification

Typecheck, lint, `npm test`, build — all clean. (There is no test harness for
the impure payout loop — a known repo gap, tracked as an unplanned finding in
`plans/README.md`; do not attempt to build one inside this plan.)

## Test plan

The pure predicate this loop trusts (`isCommissionDue`) is already pinned by
`apps/web/src/lib/commission-schedule.test.ts`. This plan's changes are I/O
orchestration; verification is typecheck + build + the operator's staged
rollout below. Do not write mock-heavy tests that test the mocks — the repo
deliberately avoids that pattern.

## Done criteria

- [ ] Indexed path queries `status == 'held' AND eligible_at <= now` ordered
      ascending, paged with `startAfter`
- [ ] Fallback path exists and alerts `payout-cycle-index`
- [ ] Malformed rows retire to `skipped_invalid`; summary counts `invalid`
- [ ] `truncated` + `indexed` surfaced in the cron response
- [ ] `firestore.indexes.json` has the transfers index; JSON parses
- [ ] Typecheck, lint, suite, build all clean; `plans/README.md` updated
- [ ] **OPERATOR STEP (record in the index row, do not perform):** deploy
      `firebase deploy --only firestore:indexes`, wait for
      `gcloud firestore indexes composite list` to show READY, and only then
      deploy this code. (The fallback makes wrong ordering non-fatal, but the
      right order avoids ever alerting.)
- [ ] After the next 1st/15th run: cron response shows `"indexed": true`

## STOP conditions

- `runPayoutCycle` no longer contains the fresh re-read guard
  (`status !== 'held'` abort) — it protects against paying a clawed-back
  share; if it's gone, the codebase drifted in a money-critical way.
- The summary object shape in the route response is transformed rather than
  spread (your new fields would be silently dropped).
- You are tempted to edit `reconcileFailedTransfers` — out of scope.

## Maintenance notes

- If `commission_mode` ever returns to `one_time`, backlog growth slows but
  the paging remains correct — no revert needed.
- The `skipped_invalid` rows are terminal by design; the finance dashboard
  ignores them. If one ever represents real owed money, the fix is a manual
  ledger correction, not a status flip.
- Watch in review: `startAfter(cursor)` uses the document snapshot (correct
  with `orderBy`), not a field value — mixing the two silently skips rows.
