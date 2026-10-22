---
id: "202610221210-H96B7N"
title: "Investigate and fix premium proof empty alert"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "d346574f7166adafe1bf4b12807f891813df5241", message: "🐛 H96B7N verified: fix paid proof cohort and median bias | details: classify thin data without false failure emails; retain read failure alerts; document production evidence and pass757tests" }
comments:
  - { author: "ORCHESTRATOR", body: "start: correct premium proof paid eligibility, unbiased median and insufficient-data alert classification" }
  - { author: "ORCHESTRATOR", body: "verified: fix paid proof cohort and median bias | details: classify thin data without false failure emails; retain read failure alerts; document production evidence and pass757tests" }
doc_version: 2
doc_updated_at: "2026-10-22T12:15:34+00:00"
doc_updated_by: "agentctl"
description: "Determine why sampled paid listings fail the six-action floor using bounded read-only evidence; fix data selection or alert classification with tests. No purchases or billing changes."
---
## Summary

Correct misleading premium-proof failure classification, paid cohort eligibility, and median selection without inventing results or lowering the publication floor.

## Context

Read-only audit found14 premium-tier listings:10comp,2subscription-backed,2unverified. Original12 sample:9comp,2subscription-backed,1unverified; 32views and zero recorded actions. Both subscription-backed listings were already sampled, totaling15views and zeroactions. Six-action floor correctly hides panel.

## Scope

Bounded read-only production audit; pure candidate eligibility and median rules; expected insufficient-data diagnostics; regression tests.

## Risks

No production writes, purchases, deployment or billing changes. Tier plus subscription reference is recorded entitlement evidence, not a new Stripe billing audit. Daily counts read after alert can include later events.

## Verify Steps

PASS: npm run type-check across four workspaces, npm test (757 tests), git diff --check. Independent reviewer found no blocking issues. Regression coverage includes eligibility, bounded sampling, UTC dates, unbiased median, insufficient data, malformed counters and database exceptions.

## Rollback Plan

Revert task implementation commit; no database records are modified.

## Notes

Evidence and limits in docs/audits/premium-proof-alert-2026-10-22.md. Insufficient data is logged, actual read failures still alert. No synthetic production events or database writes. Local-only fix; no deployment charges authorized for this new task.

