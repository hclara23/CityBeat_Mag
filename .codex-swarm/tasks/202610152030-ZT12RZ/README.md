---
id: "202610152030-ZT12RZ"
title: "Implement semi-monthly editor commission payouts and portal"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["stripe", "connect", "commissions", "reporting", "portal", "release"]
comments:
  - { author: "PLANNER", body: "Approved decomposition: cadence and payout-attached statements 202610152030-YPJ8P9; editor dashboard 202610152030-FBKEDB; YTD reconciliation and email 202610152030-RDM0NQ; verification 202610152030-TTPCR8; deployment 202610152030-WS5E44. The older release task now depends on this replacement release to prevent premature deployment." }
doc_version: 2
doc_updated_at: "2026-10-15T20:31:24+00:00"
doc_updated_by: "agentctl"
description: "Coordinate the approved editor commission policy through downstream tasks: cadence and attached statements 202610152030-YPJ8P9; authenticated payouts dashboard 202610152030-FBKEDB; 2026 YTD reconciliation and email 202610152030-RDM0NQ; end-to-end verification 202610152030-TTPCR8; and deployment 202610152030-WS5E44. CityBeat platform funds must remain accumulated under manual payout control. Only cleared editor commissions transfer on the 15th and final calendar day, with a statement each time. Deployment is capped at the explicitly approved up-to- one-time cost and approximately .10 monthly scheduler charge."
---
## Summary

Deliver the approved semi-monthly editor commission program while preserving manual control of the CityBeat platform balance.

## Scope

Coordinate cadence, statements, YTD reconciliation and email, authenticated payout visibility, verification, and production deployment.

## Risks

Duplicate transfers, premature release of platform funds, mismatched statements, authorization leaks, and scheduler edge cases.

## Verify Steps

Confirm every downstream task is completed, production is healthy, the editor sees only their own payout data, and CityBeat platform payouts remain manual.

## Rollback Plan

Disable the scheduler and revert the release while retaining immutable payout and statement records; do not reverse completed Stripe transfers automatically.

