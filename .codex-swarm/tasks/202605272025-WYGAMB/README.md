---
id: "202605272025-WYGAMB"
title: "Fix creator publish workflow"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["creator", "backend", "frontend"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "cd73f9bba335a22feafdbb822eb8960745115d87", message: "🛠️ WYGAMB fix creator publish workflow" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: creator dashboard has no submit/publish actions and the article update route checks author_id instead of created_by." }
  - { author: "ORCHESTRATOR", body: "verified: lint, type-check, and production build passed after wiring draft submit and editor publish actions through the creator article update route." }
doc_version: 2
doc_updated_at: "2026-05-27T20:28:26+00:00"
doc_updated_by: "agentctl"
description: "Wire creator dashboard actions and article update API so drafts can be submitted for review and editor accounts can publish reviewed articles from the creator workflow."
---
## Summary

Creator workflow now uses articles.created_by for ownership, preserves edit form content, maps category slugs to IDs, and exposes dashboard actions to submit drafts/rejected articles for review and publish reviewed articles for editor accounts.

## Scope

In scope: creator dashboard action buttons, creator article detail/update/delete API ownership/status handling, and edit page initial value mapping. Out of scope: rich text editor redesign and admin review page layout changes.

## Risks

Moderate risk because it updates content status transitions. The publish action is restricted to editor/admin profiles, and writer accounts can only submit drafts or rejected articles for review.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert the creator dashboard, edit page, and creator article route changes to restore the previous draft-only workflow.

