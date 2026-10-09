---
id: "202610090458-Z7HW01"
title: "Bulk social image queue with reviewed timed publishing"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved batch intake and separated review and scheduled delivery; verify temporal and authorization safeguards then deploy within existing cap" }
  - { author: "ORCHESTRATOR", body: "start: ship bulk graphics intake and independent review calendar | details: reserve unique 6 AM noon and 6 PM El Paso slots; enforce due-time claims pause controls safe retries and 5 dollar AI ceiling; add DST and worker regression tests" }
doc_version: 2
doc_updated_at: "2026-10-09T05:07:41+00:00"
doc_updated_by: "agentctl"
description: "Approved bulk intake, independent caption review, 6 AM/noon/6 PM America Denver slots, editable queue and safe delivery. Reuse existing OpenAI key with 5 USD monthly cap and existing 1 USD total build cap. No task dependencies."
---
## Summary

Bulk graphics queue with independent AI caption review and daily 06:00, 12:00 and 18:00 America/Denver publication. Existing key reuse approved.

## Scope

CODER: durable bulk intake, schedule allocation, controls and worker. TESTER: deterministic timing, budget and review tests. REVIEWER: inspect concurrency and safety. INTEGRATOR: deploy and verify public admin route and existing scheduler.

## Risks

Public posts irreversible; no early publication or uncertain retry. Preserve monthly 500 cent ceiling and remaining 1 dollar combined build allowance. Schedule handles daylight saving. Missed slots held rather than burst-posted.

## Verify Steps

Run social policy and scheduler tests, repository test suite, typecheck and lint; verify candidate then production and scheduler configuration without printing credentials.

## Rollback Plan

Pause queue and scheduler before reverting traffic; old revision publishes queued items immediately and must not be resumed with new queue data.

## Notes

603 automated tests pass across 83 files; typecheck and lint pass. Graphify contains no social/queue nodes and installed structural search finds zero symbols, so direct source inspection used. Read-only Facebook identity verification succeeded for official Page. Production image queue empty before migration. Standard OpenAI pricing verified; four-cent bound supports 93 monthly posts without raising 5 dollar ceiling.

