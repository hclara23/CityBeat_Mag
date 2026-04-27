---
id: "202604270352-V36FNN"
title: "Fix creator image upload and article creation"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["creator", "supabase", "upload"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: creator upload and article create were returning 500 due to storage and Supabase schema mismatches." }
doc_version: 2
doc_updated_at: "2026-04-27T03:52:55+00:00"
doc_updated_by: "agentctl"
description: "Wire Creator Studio upload and article creation to the production Supabase schema, add creator compatibility migration, and use service-role storage for media uploads."
---
## Summary

Creator image uploads now use service-role storage and article creation maps form data to the production schema with categories, authors, creator fields, and compatibility columns.

## Scope

In scope: creator upload API, creator article create/list API, and a Supabase migration for Creator Studio compatibility. Out of scope: full edit/delete route rewrite and visual editor redesign.

## Risks

Moderate risk because it touches production content writes. The API still requires an authenticated writer/editor profile, while storage and write operations can use the existing service-role key server-side.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed. Live verification still requires applying apps/web/supabase/migrations/20260427034000_creator_workflow_compat.sql in Supabase.

## Rollback Plan

Revert the creator upload/API changes and do not apply, or roll back, the Creator Studio compatibility migration.

