---
id: "202610221149-AD860T"
title: "Repair failed GitHub test and deployment workflows"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "12b81e2d5d6752054b798f433aff1027755acc8d", message: "🐛 AD860T verified: fix CI Node22 Firebase dependency loading | details: add bounded candidate readiness retries and skip absent reports; pass 751 tests, four type checks and fresh build on Node24" }
comments:
  - { author: "ORCHESTRATOR", body: "start: repair CI runtime mismatch and bounded deployment readiness checks | details: verify all local changes before handoff" }
  - { author: "ORCHESTRATOR", body: "verified: fix CI Node22 Firebase dependency loading | details: add bounded candidate readiness retries and skip absent reports; pass 751 tests, four type checks and fresh build on Node24" }
doc_version: 2
doc_updated_at: "2026-10-22T11:54:09+00:00"
doc_updated_by: "agentctl"
description: "Investigate failed runs with read-only GitHub access, fix local causes, verify and commit. No purchases, billing changes, pushes or deployment."
---
## Summary

Repair CI runtime mismatch and deployment smoke timeout handling based on GitHub run evidence.

## Context

Run 39739639223 failed type checking on Node20; firebase-admin14 and optional Firestore9 require Node22. Deployment run 39735491236 exited28 on its first candidate request; three later deploys succeeded. No evidence of billing failure.

## Scope

Align test Node runtime with deployment, check required Firebase optional packages, guard absent test artifacts, and add bounded candidate readiness checks.

## Risks

No remote writes or deployment authorized. Retry only read-only readiness requests and retain all existing smoke assertions.

## Verify Steps

PASS: npm test (751 tests across 107 files), npm run type-check (four workspaces), fresh npm run build -- --force (no cache), Firebase module load, workflow YAML parsing, git diff --check. Reviewed with no actionable findings. Local Node24; clean Node22 CI rerun not performed. Global task lint reports pre-existing unrelated task metadata/dependency errors.

## Rollback Plan

Revert the task implementation commit locally; no production state is changed.

## Notes

Read-only GitHub investigation only. Node22 matches existing deploy workflow. Candidate readiness retries GET /en at most six times with 30-second timeouts and five-second delays; original smoke assertions remain. Missing optional report artifacts are skipped.

