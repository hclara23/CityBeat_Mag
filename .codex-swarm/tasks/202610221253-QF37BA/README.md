---
id: "202610221253-QF37BA"
title: "Verify and repair customer action tracking without synthetic traffic"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "c507094f9b34ae690503bf671a6e7eecfa5387e8", message: "🧪 QF37BA verified: repair customer action persistence and atomic lead counting | details: exclude internal traffic, prevent duplicate views, validate phone links and listing IDs; pass 775 tests and four package type checks; document read-only production evidence without synthetic analytics" }
comments:
  - { author: "ORCHESTRATOR", body: "start: verify customer action pipeline with mocked storage | details: fix silent tracking and detached lead writes without inflating stats" }
  - { author: "ORCHESTRATOR", body: "verified: repair customer action persistence and atomic lead counting | details: exclude internal traffic, prevent duplicate views, validate phone links and listing IDs; pass 775 tests and four package type checks; document read-only production evidence without synthetic analytics" }
doc_version: 2
doc_updated_at: "2026-10-22T13:04:46+00:00"
doc_updated_by: "agentctl"
description: "Audit paid listing actions and read-only evidence; verify phone website directions and leads with isolated mocked persistence; repair bugs without production analytics inflation or purchases."
---
## Summary

Verify first-party customer-action tracking and repair silent write failures, detached lead counters and duplicate views without synthetic production events.

## Context

Read-only audit found 15 total views and zero saved quote requests across two subscription-backed published listings. One has no website URL and another lacks owner_id. Historic clicks cannot be reconstructed because the old endpoint concealed failures. See docs/audits/customer-action-tracking-2026-10-22.md.

## Scope

Read-only production audit; mock-backed phone website directions and quote tests; observable tracking failures; atomic quote and lead stats persistence; stable page-view tracking.

## Risks

No production writes, purchases, billing changes or deployment. Missing recorded actions cannot establish absence of real clicks because prior writes failed silently. Do not infer paid status solely from subscription references.

## Verify Steps

Passed npm run type-check in all four packages; npm test passed all 775 tests, including 18 new isolated tracking and quote-handler tests. git diff --check passed. Production audit used read-only Firestore, Cloud Run logs and raw HTML GETs without running view trackers.

## Rollback Plan

Revert implementation commit; no production data has changed.

## Notes

Fixed observable click failures, atomic lead persistence, validated phone links, consistent ID validation and duplicate metadata-refresh views. No synthetic production events, historical backfill, purchases, billing changes or deployment. Missing ownership metadata remains for verified customer-data reconciliation.

