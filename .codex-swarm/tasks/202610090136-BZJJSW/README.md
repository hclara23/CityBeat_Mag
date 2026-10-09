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
doc_updated_at: "2026-10-09T01:38:26+00:00"
doc_updated_by: "agentctl"
description: "Approved bilingual signup/checkout disclosure: Founders USD9.99/month limited to first100 businesses, regular Premium USD19.99/month. Verify cap enforcement; preserve Premier USD9.99 total for3locations. Include rebuild within same USD1 total release cap."
---
## Summary

Make every Founders offer disclose first100 businesses and regular USD19.99/month Premium price, with bilingual copy and no automatic later price increase.

## Scope

Shared plan descriptions, Spanish claim copy, Premier popup/banner and dedicated checkout. Check existing cap paths, fail closed on unavailable counts. Preserve annual USD99/year and Premier USD9.99 total all3locations. Same USD1 total build cap approved.

## Risks

Do not imply Founders rises to standard rate after signup. Generic directory checkout is per location; Premier remains explicitly bundled. Existing cap uses count checks, not atomic reservations; audit concurrency separately.

## Verify Steps

Run pricing and full unit tests, web typecheck and lint. Inspect all Founders checkout sources and rendered bilingual copy. Production smoke after combined release.

## Rollback Plan

Revert only scoped copy/availability changes and restore prior Cloud Run traffic; do not alter existing paid subscriptions or prices.

## Notes

Shared EN plan descriptions and ES claim copy disclose first100 businesses and regular USD19.99/month; annual99/year stays distinct; Premier all3locations999cents preserved with comparison per location. Self-serve cap now reuses shared fail-closed count including paid unfulfilled orders; Premier checkout also checks it. Audit found concurrent checkout oversell risk: no atomic spot reservation; user separately asked whether to extend scope to hard-cap reservations. 582 tests, typecheck and lint pass. No prices or subscriptions changed.

