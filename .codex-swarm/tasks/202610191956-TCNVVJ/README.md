---
id: "202610191956-TCNVVJ"
title: "Temporarily suppress owner ROI missing heartbeat"
status: "DOING"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: add expiring owner ROI missing-heartbeat grace | details: preserve other alerts and prevent false recovery email; verify expiry boundaries and isolated no-delivery regressions" }
doc_version: 2
doc_updated_at: "2026-10-19T19:57:03+00:00"
doc_updated_by: "agentctl"
description: "Approved targeted exception only for missing owner ROI heartbeat until November 2 2026 15:00 UTC, 24 hours after scheduled November1 run. Preserve actual failure alerts and all other liveness alerts. No live cron or email tests."
---
## Summary

One-time missing-heartbeat grace for owner ROI until November2 2026 15:00 UTC.

## Scope

Only cron:owner-reports with absent heartbeat enters waiting. Recorded stale runs and other jobs still alert. Heartbeat does not emit liveness recovery while owner report is waiting.

## Risks

Production unchanged until deployment. Fixed absolute expiry needs no scheduled cleanup. Actual owner-report execution failures remain untouched; no heartbeat fabricated.

## Verify Steps

18 isolated targeted tests pass: before/at/after expiry, other stale jobs, actual recorded stale run, real success, no artificial recovery, no delivery calls. TypeScript passes. No production cron invoked.

## Rollback Plan

Revert scoped grace and recovery gate without changing data or scheduler.

## Notes

User approved targeted suppression and automatic expiry, prohibits reports/emails. Implementation ready; deployment requires specific spending approval.

