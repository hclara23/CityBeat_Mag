---
id: "202610191956-TCNVVJ"
title: "Temporarily suppress owner ROI missing heartbeat"
status: "DONE"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "73f0cae839b1ba9f010cea4155e223970d9ae92b", message: "🚧 TCNVVJ start: add expiring owner ROI missing-heartbeat grace | details: preserve other alerts and prevent false recovery email; verify expiry boundaries and isolated no-delivery regressions" }
comments:
  - { author: "ORCHESTRATOR", body: "start: add expiring owner ROI missing-heartbeat grace | details: preserve other alerts and prevent false recovery email; verify expiry boundaries and isolated no-delivery regressions" }
  - { author: "ORCHESTRATOR", body: "verified: deploy automatically expiring owner ROI missing-heartbeat suppression | details: confirm healthy production revision and unchanged report schedule; preserve other alerts with no cron calls or email tests within combined budget" }
doc_version: 2
doc_updated_at: "2026-10-19T20:05:49+00:00"
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

Deployed October19 source73f0cae. Build88a14465-82b0-4e57-a08c-f9d3d02658b5 SUCCESS 4m04s, estimated compute USD0.064; combined heartbeat and suppression builds approximately USD0.16 within same USD1 cap. Production100 percent citybeat-web-roi-grace-73f0cae digest sha256:d5e1d0d7267d9b336b10ef3aab8e0d04fa841c3aea0c72d034431e28c9644811. Initial candidate startup Firestore timeout resolved; two candidate checks and public health healthy. No cron/report/email endpoint invoked. Scheduler lastAttempt October1 unchanged, next November1. Grace expires automatically November2 15:00UTC, 08:00America/Denver; actual failures and other liveness alerts unchanged. No fake heartbeat or recovery notification. Rollback citybeat-web-roi-d810438.

