---
id: "202606050550-ZE50PA"
title: "Add daily auto article research agent"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["backend", "cron", "articles", "automation"]
verify: ["npm run type-check --workspace=@citybeat/lib", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "b2d5d364321f53795ec0b5a0491416aacb697a29", message: "📰 202606050550-ZE50PA add daily auto article research agent" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Add a daily source-backed article drafting cron that inserts generated El Paso stories as pending_review for human editors." }
  - { author: "ORCHESTRATOR", body: "verified: migration applied, type-checks passed, dry-run found local El Paso topics, live run created three pending-review drafts, repeat run created zero more, and the web production build passed." }
doc_version: 2
doc_updated_at: "2026-06-05T06:13:10+00:00"
doc_updated_by: "agentctl"
description: "Create a production cron workflow that finds recent El Paso topics online, drafts three source-backed articles per day, and places them into the review queue for human approval before publishing."
---
## Summary

Added a daily source-backed auto article agent that drafts El Paso story candidates into the human review queue.

## Scope

Added article generation metadata columns, a reusable @citybeat/lib auto-article generator, a protected /api/cron/auto-articles route, and a second daily Vercel cron. The agent uses local El Paso RSS feeds first, falls back to GDELT search, filters for local relevance, stores source URLs, caps itself at three generated drafts per UTC day, and inserts drafts as pending_review under citybeat@yahoo.com.

## Risks

Source feeds can include irrelevant items, so the filter excludes staff profiles and requires local terms. Drafts remain unpublished and require human review. The app now uses the Hobby plan maximum of two Vercel cron jobs.

## Verify Steps

supabase db push --dry-run; supabase db push --yes; npm run type-check --workspace=@citybeat/lib; npm run type-check --workspace=@citybeat/web; dry-run agent invocation; live one-time agent invocation; repeat invocation daily-cap check; npm run build --workspace=@citybeat/web; supabase migration list.

## Rollback Plan

Remove the /api/cron/auto-articles route and Vercel cron entry, revert the package export and generator module, and apply a follow-up migration to drop generated article metadata if no longer needed.

## Notes

Created three pending-review production drafts for today and verified the second run generated zero additional drafts because the daily cap was reached.

