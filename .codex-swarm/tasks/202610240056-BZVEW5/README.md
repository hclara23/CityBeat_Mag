---
id: "202610240056-BZVEW5"
title: "Build unified directory search and reviewed expansion preview"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "b80cb0846b3f5f704f561df43d65e3a8f41dbfcd", message: "✨ BZVEW5 start: deliver unified full-corpus directory search, city and ZIP filters, mobile layout and recovery states | details: add emulator integration verification and local-only expansion report." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved read-only review tools and local search improvements; verify all changes without deployment or subagents." }
  - { author: "ORCHESTRATOR", body: "start: deliver unified full-corpus directory search, city and ZIP filters, mobile layout and recovery states | details: add emulator integration verification and local-only expansion report." }
  - { author: "ORCHESTRATOR", body: "verified: local implementation passes full 111-file test suite, TypeScript, production build, emulator API checks with 8101 records, and desktop/mobile English/Spanish browser checks. Import preview and provenance manifest remain review-only | details: no production changes. Capacity and remaining release checks documented." }
doc_version: 2
doc_updated_at: "2026-10-24T01:16:24+00:00"
doc_updated_by: "agentctl"
description: "Approved local-only implementation: review legacy provenance without data changes; unified search and mobile filters; 100-record public-domain import preview with location and duplicate checks; full local verification. No publishing, deployment, subagents or paid services."
---
## Summary

Implement the approved local-only directory improvement phase.

## Context

Approved October 23, 2026. No subagents. Assess before publishing or deployment.

## Scope

Prepare legacy provenance correction manifest without changing records; implement unified search and mobile filters; prepare 100 public-domain outlet candidates with duplicate/location checks; local tests and build.

## Risks

No owner content, claims, payment state, production data or hosting writes. Full search must fail explicitly rather than silently truncate. Pilot addresses require review before publication.

## Verify Steps

Unit/regression tests, TypeScript, production build, local UI and API verification using safe fixtures, manifest count and privacy checks.

## Rollback Plan

No deployment or production mutations. Revert task-scoped local commits if required.

## Notes

Phase one committed 3c20d28. Implemented shared search and responsive filters. Full suite (111 files), TypeScript, production build and emulator API checks passed with 8,101 synthetic listings. Desktop and 390px mobile browser checks include English/Spanish search, empty state and clear-filter recovery. Preview: 91 new-review, 7 possible matches, 1 reject, 1 duplicate; zero publication-ready. No production writes or deployment. Detailed evidence and release limits: docs/audits/directory-expansion-local-2026-10-23.md.

