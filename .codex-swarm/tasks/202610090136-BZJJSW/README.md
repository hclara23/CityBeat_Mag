---
id: "202610090136-BZJJSW"
title: "Clarify Founders first-100 offer and regular Premium pricing"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: user approved clear first100 pricing disclosure and limit audit within same USD1 release cap." }
doc_version: 2
doc_updated_at: "2026-10-09T01:46:00+00:00"
doc_updated_by: "agentctl"
description: "Approved bilingual signup/checkout disclosure: Founders USD9.99/month limited to first100 businesses, regular Premium USD19.99/month. Verify cap enforcement; preserve Premier USD9.99 total for3locations. Include rebuild within same USD1 total release cap."
---
## Summary

Make every Founders offer disclose first100 businesses and regular USD19.99/month Premium price, with bilingual copy and no automatic later price increase.

## Scope

Approved extension: hard100-business capacity across all5 Founders checkout paths, shared Firestore transaction reservations, stable Stripe retries and confirmed unpaid-expiry release. Bilingual first100/regular19.99 copy, annual99/year preserved, Premier999cents total3locations. Build database-backed locale pages at runtime to avoid credential-free prerender timeouts. All work within same USD1 build cap.

## Risks

Do not imply Founders rises to standard rate after signup. Generic directory checkout is per location; Premier remains explicitly bundled. Existing cap uses count checks, not atomic reservations; audit concurrency separately.

## Verify Steps

Run pricing and full unit tests, web typecheck and lint. Inspect all Founders checkout sources and rendered bilingual copy. Production smoke after combined release.

## Rollback Plan

Revert only scoped copy/availability changes and restore prior Cloud Run traffic; do not alter existing paid subscriptions or prices.

## Notes

User explicitly approved hard atomic limit. Implemented shared capacity transaction, imports legacy Stripe history, reconciles paid listings/orders, reserves distinct business not location, persists exact checkout parameters/idempotency, releases known checkouts only after confirmed expired unpaid. All5 routes use helper; cart excludes directory. Unknown legacy or provider outcomes conservatively held for staff reconciliation. 584 tests/typecheck/lint/diff-check pass. External reviewer unavailable; main review completed. No real payment/checkout created. Combined production build next.

