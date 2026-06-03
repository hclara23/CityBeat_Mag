---
id: "202606031810-25PSWJ"
title: "Fix profile role retrieval on login"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "5090c1b31617083dfe0a401049ef4ad86ac13c2b", message: "🐛 25PSWJ fix: check response.cookies in login route getter | details: fallback to request.cookies if not found, enabling authenticated profiles query immediately after signIn." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: fix login route cookie getter to check response.cookies, allowing authenticated profiles query immediately after signIn." }
  - { author: "ORCHESTRATOR", body: "verified: verified using Next.js types that response.cookies.get(name)?.value works, ran all verify workspace linting, typechecking, and production builds successfully." }
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

