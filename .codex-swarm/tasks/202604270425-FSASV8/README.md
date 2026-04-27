---
id: "202604270425-FSASV8"
title: "Fix admin review queue article join"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["admin", "supabase", "creator"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "5454f5f021909f1a83af7e1ee29c94cbd31af162", message: "🛠️ FSASV8 fix admin review queue relationships" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: pending review articles existed in Creator Studio but admin queue was empty due to an invalid profiles join on articles.author_id." }
  - { author: "ORCHESTRATOR", body: "verified: lint, type-check, and production build passed for the web workspace after updating admin article relationships." }
doc_version: 2
doc_updated_at: "2026-04-27T04:28:40+00:00"
doc_updated_by: "agentctl"
description: "Update admin review queue and article detail APIs to use production article author/profile relationships so pending_review articles appear."
---
## Summary

Admin article list/detail APIs now read byline data from authors and submitter data from profiles via created_by, matching the production schema.

## Scope

In scope: admin article list API and admin article detail API relationship selects and response shaping. Out of scope: creator article submission flow, database schema changes, and dashboard visual redesign.

## Risks

Low risk. This changes select joins and response shaping while preserving editor authorization and status filtering.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert the two admin API route changes to restore the previous select shape if the production schema differs unexpectedly.

## Notes

The previous queue fallback returned an empty array for relationship/schema errors, masking the invalid join. Errors now surface so production issues are visible.

