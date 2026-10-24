---
id: "202610240056-BZVEW5"
title: "Build unified directory search and reviewed expansion preview"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-24T00:57:11+00:00"
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

