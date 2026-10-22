---
id: "202610221210-H96B7N"
title: "Investigate and fix premium proof empty alert"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: correct premium proof paid eligibility, unbiased median and insufficient-data alert classification" }
doc_version: 2
doc_updated_at: "2026-10-22T12:11:56+00:00"
doc_updated_by: "agentctl"
description: "Determine why sampled paid listings fail the six-action floor using bounded read-only evidence; fix data selection or alert classification with tests. No purchases or billing changes."
---
## Summary

Correct misleading premium-proof failure classification, paid cohort eligibility, and median selection without inventing results or lowering the publication floor.

## Scope

Bounded read-only production audit; pure candidate eligibility and median rules; expected insufficient-data diagnostics; regression tests.

## Risks

No production writes, purchases, deployment or billing changes. Tier plus subscription reference is recorded entitlement evidence, not a new Stripe billing audit. Daily counts read after alert can include later events.

## Verify Steps

Run premium-proof regression tests, root type checking and complete unit suite. Check that read errors still reportFailure and thin data does not.

## Rollback Plan

Revert task implementation commit; no database records are modified.

