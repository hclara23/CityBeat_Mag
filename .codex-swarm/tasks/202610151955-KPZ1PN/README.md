---
id: "202610151955-KPZ1PN"
title: "Verify recurring commissions payouts and monthly statements"
status: "DOING"
priority: "high"
owner: "TESTER"
depends_on: ["202610151955-098Z3A", "202610151955-PSTR9K"]
tags: ["testing", "stripe", "reconciliation"]
verify: ["npm test", "npm --prefix apps/web run type-check"]
comments:
  - { author: "TESTER", body: "Start: verify recurring renewal commission attribution and idempotency, platform manual-payout isolation, catch-up ledger behavior, monthly statement totals and privacy, scheduler cadence and ops health, plus payout refund and reconciliation regressions; run focused, full web, repository, and type-check validation without external financial or email side effects" }
doc_version: 2
doc_updated_at: "2026-10-15T20:21:39+00:00"
doc_updated_by: "agentctl"
description: "Reconcile the forensic findings and implemented behavior end to end: recurring renewal attribution, commission calculation, available-balance timing, Connect transfer and payout-state handling, platform manual-payout isolation, statement totals, idempotency, refunds and disputes, and notification delivery. Use tests and read-only production evidence; do not initiate payments, transfers, or payouts."
---
## Summary

Verified the combined recurring-commission and monthly-statement workflow locally. Added one targeted integration fix so successful manual catch-up transfers recorded with created_at are included in the issue-month statement and counted as transferred/YTD paid when their Stripe transfer is present. No Stripe request, email, setting change, fund movement, or deployment occurred.

## Context

The recurring $9.99 renewal path now resolves both legacy invoice.subscription and current invoice.parent.subscription_details.subscription shapes. Stable per-invoice/per-payee ledger IDs and Stripe idempotency keys collapse webhook and reconciliation retries. Prior task evidence records CityBeat platform payouts as manual, editor payouts as daily two-day rolling, and the approved $4.50 catch-up as a successful connected-account transfer; this verification did not re-query or mutate Stripe.

## Scope

Reviewed and exercised renewal attribution, 45% commission calculation, ledger and Stripe transfer idempotency, transfer uncertainty fail-closed behavior, hold and twice-monthly cadence, refunds/clawbacks and reconciliation cursors, payee-scoped statement totals, manual catch-up visibility, HTML escaping and bank-data exclusion, delivery retry reservation, scheduler-manifest cadence, and ops-health liveness. The authenticated cron route and email provider were not invoked.

## Risks

Live Cloud Scheduler inventory remains unverified because the available principal lacks cloudscheduler.jobs.list; the committed manifest, cron route, and liveness cross-check are internally consistent. Platform manual payout status and the editor bank payout schedule are live Stripe settings evidenced by the completed configuration task, not reproducible unit-test state. PLANNER corrected the task verification metadata to use the canonical root npm test runner, which covers all web and packages/lib tests.

## Verify Steps

1. Focused payout suite: npx tsx --test over stripe-invoice, payout-split, payouts, commission-schedule, payout-reconcile-cursor, refund-decision, finance-rollup, payout-statements, cron-cadence, and ops-health: 92/92 passed. 2. Canonical repository suite: npm test: 640/640 passed (620 web, 20 packages/lib). 3. npm run type-check: 4/4 workspaces passed. 4. No external side effects were triggered.

## Rollback Plan

Revert this task's implementation commit to restore prior statement timestamp handling. If release verification finds any mismatch, keep payout-statement scheduling disabled or undeployed while preserving ledger records; do not reverse the already-approved Stripe transfer automatically. Manual platform payout configuration should be changed only through a separately approved Stripe action.

## Notes

Release recommendation: proceed after the integrator confirms the scheduler job exists during deployment. The statement regression now covers the approved catch-up ledger shape: created_at plus status=paid plus stripe_transfer_id.

