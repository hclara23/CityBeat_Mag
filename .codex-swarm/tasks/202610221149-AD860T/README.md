---
id: "202610221149-AD860T"
title: "Repair failed GitHub test and deployment workflows"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: repair CI runtime mismatch and bounded deployment readiness checks | details: verify all local changes before handoff" }
doc_version: 2
doc_updated_at: "2026-10-22T11:50:38+00:00"
doc_updated_by: "agentctl"
description: "Investigate failed runs with read-only GitHub access, fix local causes, verify and commit. No purchases, billing changes, pushes or deployment."
---
## Summary

Repair CI runtime mismatch and deployment smoke timeout handling based on GitHub run evidence.

## Scope

Align test Node runtime with deployment, check required Firebase optional packages, guard absent test artifacts, and add bounded candidate readiness checks.

## Risks

No remote writes or deployment authorized. Retry only read-only readiness requests and retain all existing smoke assertions.

## Verify Steps

Run root type checking, complete unit suite, workflow validation and deterministic mocked readiness tests.

## Rollback Plan

Revert the task implementation commit locally; no production state is changed.

