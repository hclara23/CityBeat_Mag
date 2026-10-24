---
id: "202610240056-BZVEW5"
title: "Build unified directory search and reviewed expansion preview"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved read-only review tools and local search improvements; verify all changes without deployment or subagents." }
doc_version: 2
doc_updated_at: "2026-10-24T01:00:58+00:00"
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

Phase 1 prepared local-only manifests at .tmp/directory-review-2026-10-23: 100 candidates (91 new-review, 7 possible-match, 1 rejected, 1 batch duplicate). 3812 Google-source and 3857 missing-source records flagged; 14 protected. No automatic patches or production writes; 4 tests passed.

