# Plan 006: Money hygiene — dead payout setting rejected, claim route rate-limited, CRON_SECRET rotation runbook

> **Executor instructions**: Follow step by step; run every verification;
> honor STOP conditions; update `plans/README.md` when done. Part C is an
> OPERATOR runbook — the executor writes nothing for it and must not run its
> commands.
>
> **Drift check (run first)**: `git diff --stat 17ab79a..HEAD -- apps/web/src/app/api/admin/payout-settings/route.ts apps/web/src/app/api/directory/claim/route.ts`
> Mismatch with excerpts = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt + security
- **Planned at**: commit `17ab79a`, 2026-08-28

## Why this matters

Three small, unrelated-looking items that share one property: each is a place
where the operator believes something about the money system that is false.

- **A. Dead commission setting.** The godmode payout settings API accepts
  `service_payout_percent` and `default_payout_percent`, and the live
  Firestore document has `service_payout_percent.directory = 50` — but the
  payout engine (`payoutSplit` → `computeSplit`) reads only the hardcoded
  `SPLIT_RATES` table plus `split_overrides`. The only reader of the dead
  fields is `resolvePayoutPercent`, called only by `payoutToUser`, which is
  deprecated with zero callers. The operator set 50% believing it did
  something. Accepting the write is the bug.
- **B. The one money route without a rate limit.** `/api/directory/claim`
  creates real Stripe Checkout sessions and is the only session-creating
  route with no `checkRateLimit` call (`/api/stripe/checkout` has one).
- **C. `CRON_SECRET` is burned.** The bearer token that authenticates all 16
  cron endpoints was echoed into a working-session transcript on 2026-08-27
  (a gcloud flag error reflected the argument). It must be rotated; rotation
  touches Cloud Run and every scheduler job **together**, which is why it
  needs a runbook rather than ad-hoc commands.

## Current state

- `apps/web/src/app/api/admin/payout-settings/route.ts:28-34` (PATCH body
  handling; developer-gated):

```ts
  const patch: any = {}
  if (typeof body.default_payout_percent === 'number') patch.default_payout_percent = body.default_payout_percent
  if (body.service_payout_percent && typeof body.service_payout_percent === 'object') {
    patch.service_payout_percent = body.service_payout_percent
  }
  if (body.user_overrides && typeof body.user_overrides === 'object') {
    patch.user_overrides = body.user_overrides
```

- The godmode UI (`app/[locale]/admin/(protected)/payouts/page.tsx`) edits
  only `split_overrides` and `commission_mode` — no UI change is needed.
- Rate-limit exemplar — `apps/web/src/app/api/stripe/checkout/route.ts:3,29`:

```ts
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
...
  const rl = await checkRateLimit(`checkout:ip:${getClientIp(req)}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
```

- `/api/directory/claim` (`app/api/directory/claim/route.ts`) has no
  `checkRateLimit` import or call; its `POST` begins by checking
  `STRIPE_SECRET_KEY`, then parses the body. It requires a signed-in user
  (`getServerUser`) — the limit is abuse hardening on top of auth.
- Cron endpoints authenticate with
  `request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}``
  (see any `app/api/cron/*/route.ts`). Scheduler jobs live in project
  `kerstenblueprint`, region `us-central1` (16 jobs at plan time — the 14 in
  CLAUDE.md plus `citybeat-reconcile-payouts` and `citybeat-payout-cycle`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/web && npx tsc --noEmit` | exit 0 |
| Lint | `cd apps/web && npm run lint` | clean |
| Suite | `npm test` (root) | 0 failures |
| Build | `cd apps/web && npx next build` | exit 0 |

## Scope

**In scope** (executor):
- `apps/web/src/app/api/admin/payout-settings/route.ts`
- `apps/web/src/app/api/directory/claim/route.ts`

**Out of scope**:
- `lib/payouts.ts` — do NOT delete `resolvePayoutPercent`/`payoutToUser`;
  they are deprecated-but-documented; removal is a separate cleanup.
- The payouts UI page (already clean).
- Part C's commands — operator-only; the executor's deliverable for C is
  nothing (the runbook below IS the deliverable, already written).

## Git workflow

Branch `advisor/006-money-hygiene`; one emoji-prefixed commit; **do not
push** (push deploys production).

## Steps

### Step A: Reject writes to the dead commission fields

Replace the two accepting branches in the PATCH handler with an explicit 400:

```ts
  // These fields are NOT read by the payout engine: payoutSplit/computeSplit
  // use the SPLIT_RATES table plus split_overrides only. Accepting them let a
  // godmode operator set "directory: 50%" that silently did nothing (the live
  // settings doc really contains that value). Rejecting is kinder than
  // ignoring — it tells the caller which knob actually works.
  if ('service_payout_percent' in body || 'default_payout_percent' in body) {
    return NextResponse.json(
      { error: 'service_payout_percent/default_payout_percent are not read by the payout engine. Configure split_overrides (per-user percents) instead.' },
      { status: 400 }
    )
  }
```

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0.

### Step B: Rate-limit the claim route

In `app/api/directory/claim/route.ts`, mirror the exemplar exactly: import
`getClientIp, checkRateLimit` from `@/lib/auth-security`, and after the
`getServerUser` check succeeds add:

```ts
    // Same throttle as /api/stripe/checkout — this route creates real Stripe
    // Checkout sessions and was the only session-creating route without one.
    const rl = await checkRateLimit(`claim:ip:${getClientIp(request)}`, { max: 20, windowMs: 60 * 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
```

**Verify**: `cd apps/web && npx tsc --noEmit` → exit 0; then full suite,
lint, build.

### Part C: CRON_SECRET rotation — OPERATOR RUNBOOK (do not execute)

All placeholders; never write the real values anywhere, including shells with
history. Rotation must be atomic-ish: between step 2 and step 3 the crons 401 —
run it in one sitting, ideally right after the 11:00 social cron (largest gap
in the schedule).

1. Generate: `NEW=$(openssl rand -hex 24)` (keep in the shell only).
2. Cloud Run:
   `gcloud run services update citybeat-web --region us-central1 --project kerstenblueprint --update-env-vars CRON_SECRET=$NEW`
   (wait for the new revision to be Ready).
3. Every scheduler job (16 at plan time — list them first with
   `gcloud scheduler jobs list --location us-central1`):
   `gcloud scheduler jobs update http <JOB> --location us-central1 --update-headers "Authorization=Bearer $NEW"`
4. Verify: `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NEW" "https://citybeatmag.co/api/cron/payout-cycle?dryRun=1"` → 200;
   the same with the OLD value → 401.
5. `unset NEW; history -c` (or close the shell).
6. Watch `system_alerts` / ALERT_EMAIL for 24h — any cron alerting
   `Unauthorized` was missed in step 3.

## Test plan

No new unit tests: Step A is a 6-line guard on a developer-gated route and
Step B copies a proven pattern verbatim; both are covered by typecheck +
existing suite (which must stay green). Adding mock-route tests would test
the mocks — against repo convention.

## Done criteria

- [ ] PATCH with `{"service_payout_percent":{"directory":10}}` shape is
      rejected 400 (verify by reading the code path — no live call needed)
- [ ] `grep -n "checkRateLimit" apps/web/src/app/api/directory/claim/route.ts` → 1 match
- [ ] Typecheck/lint/suite/build clean
- [ ] `plans/README.md` updated; Part C handed to the operator (link this file)

## STOP conditions

- The payout settings PATCH handler shape differs from the excerpt.
- `checkRateLimit`/`getClientIp` signatures differ from the exemplar usage.
- Anyone asks you to run Part C — it is operator-only.

## Maintenance notes

- When `payoutToUser`/`resolvePayoutPercent` are eventually deleted, also
  delete the dead fields from `getPayoutSettings`' defaults and the stored
  document (separate, trivial cleanup — note it in that PR).
- After rotation, the transcript-burned value is inert; no code change needed.
- If a 17th cron is added, the rotation runbook's job list grows with it —
  CLAUDE.md's cron table is the source of truth.
