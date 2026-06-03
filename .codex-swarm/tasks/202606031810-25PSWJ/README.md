---
id: "202606031810-25PSWJ"
title: "Fix profile role retrieval on login"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: fix login route cookie getter to check response.cookies, allowing authenticated profiles query immediately after signIn." }
doc_version: 2
doc_updated_at: "2026-06-03T18:10:27+00:00"
doc_updated_by: "agentctl"
description: "Update login route cookie getter to check response.cookies, allowing authenticated profiles query immediately after signIn."
---
## Summary

Update the /api/auth/login route to check response.cookies in addition to request.cookies inside the get(name) cookie retriever. This ensures the supabase client can read the session cookie set by signInWithPassword during the same request lifecycle, enabling the profiles query to run authenticated.

## Scope

Modifies apps/web/src/app/api/auth/login/route.ts

## Risks

Low. Changes the temporary route-specific supabase cookie getter to check response.cookies first.

## Verify Steps

Run npm run lint/type-check/build inside @citybeat/web workspace, and run a node script to verify login and profiles retrieval succeed with correct role indicators.

## Rollback Plan

Revert change in apps/web/src/app/api/auth/login/route.ts.

