---
id: "202610090458-Z7HW01"
title: "Bulk social image queue with reviewed timed publishing"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "0ce59d8c0b38cfaf27c19a8ab6487a5cd3e9ca3f", message: "🚧 Z7HW01 start: add queue API boundary regression tests | details: verify concurrent intake duplicate suppression rights checks slot conflicts and review invalidation without external publication" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved batch intake and separated review and scheduled delivery; verify temporal and authorization safeguards then deploy within existing cap" }
  - { author: "ORCHESTRATOR", body: "start: ship bulk graphics intake and independent review calendar | details: reserve unique 6 AM noon and 6 PM El Paso slots; enforce due-time claims pause controls safe retries and 5 dollar AI ceiling; add DST and worker regression tests" }
  - { author: "ORCHESTRATOR", body: "start: add queue API boundary regression tests | details: verify concurrent intake duplicate suppression rights checks slot conflicts and review invalidation without external publication" }
  - { author: "ORCHESTRATOR", body: "verified: deploy bulk scheduled social queue to all production traffic | details: confirm 608 tests and official Facebook identity; activate existing ten-minute El Paso scheduler and verify HTTP 200; confirm live empty dashboard and preserve no immediate publication safeguards" }
doc_version: 2
doc_updated_at: "2026-10-09T05:22:18+00:00"
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

608 tests pass across 84 files including real worker with mocked boundaries and concurrent API intake/edit tests. Typecheck/lint pass. Independent reviewer found no release blocker. Local browser pause/edit and 390px layout pass; extension permission blocked automated file selection, API multipart intake passed. Candidate and live worker return 200 enabled true with empty results. Anonymous queue API returns 401. Official Facebook Page identity verified. Premier and Machelle regression checks pass.

## Rollback Plan

Pause queue and scheduler before reverting traffic; old revision publishes queued items immediately and must not be resumed with new queue data.

## Notes

Production 100 percent citybeat-web-queue-d00c9c5, digest sha256:18c816da6a28b50ab8b8f9ed9625ac3d107fdbcf7afd5c2016fbc55e34b46dea. Build b39e457f-d8d4-4c06-87ac-25ff74de5549 SUCCESS, 10m36s approx USD0.032 within existing cap. Existing citybeat-social job enabled every ten minutes America/Denver, queue=1 URI, 600s scheduler and 300s service deadlines. Scheduler secret matches app. Live admin shows Active and empty queue. No real social post or paid AI test sent. Main implementation d00c9c5; added API regression tests 0ce59d8. Screenshot .tmp/social-queue-live.png.

