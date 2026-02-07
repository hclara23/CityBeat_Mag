---
id: "202602070124-CZKFSD"
title: " QA and release readiness^"
status: "DOING"
priority: "high"
owner: "TESTER"
depends_on: ["^[]^"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start:_QA_smoke_tests_and_release_readiness_notes." }
  - { author: "ORCHESTRATOR", body: "Added QA smoke test notes and release checklist in docs/qa/2026-02-07-qa-notes.md. Tests not run." }
doc_version: 2
doc_updated_at: "2026-02-07T02:10:20+00:00"
doc_updated_by: "agentctl"
description: "^Role: QA Release Captain. Define definition of done smoke tests basic E2E plan release checklist and staged rollout plan.^"
---
## Summary

Update QA and release docs to reflect ads API auth requirements and required environment variables.

## Scope

Updated TESTING.md with ads API auth guidance and refreshed PRE_DEPLOYMENT_CHECKLIST.md with required Supabase and auth env vars.

## Risks

Docs only; ensure deployment env vars match these updates.

## Verify Steps

- ...

## Rollback Plan

- ...

## Verify Steps^

N/A (documentation update). Confirm docs render correctly.

## Rollback Plan^

Revert commit c60e26e.

