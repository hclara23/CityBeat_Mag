---
id: "202610221253-QF37BA"
title: "Verify and repair customer action tracking without synthetic traffic"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: verify customer action pipeline with mocked storage | details: fix silent tracking and detached lead writes without inflating stats" }
doc_version: 2
doc_updated_at: "2026-10-22T12:54:23+00:00"
doc_updated_by: "agentctl"
description: "Audit paid listing actions and read-only evidence; verify phone website directions and leads with isolated mocked persistence; repair bugs without production analytics inflation or purchases."
---
## Summary

Verify first-party customer-action tracking and repair silent write failures, detached lead counters and duplicate views without synthetic production events.

## Scope

Read-only production audit; mock-backed phone website directions and quote tests; observable tracking failures; atomic quote and lead stats persistence; stable page-view tracking.

## Risks

No production writes, purchases, billing changes or deployment. Missing recorded actions cannot establish absence of real clicks because prior writes failed silently. Do not infer paid status solely from subscription references.

## Verify Steps

Execute isolated action and quote persistence tests, full unit suite and workspace type checks. Confirm tests never call live analytics, AI classification or email providers.

## Rollback Plan

Revert implementation commit; no production data has changed.

