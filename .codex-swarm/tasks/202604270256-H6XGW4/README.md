---
id: "202604270256-H6XGW4"
title: "Fix Supabase SSR cookie adapter"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "supabase", "vercel"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: reproduced live login returning 200 without Set-Cookie headers and traced it to the installed Supabase SSR cookie API." }
doc_version: 2
doc_updated_at: "2026-04-27T02:57:07+00:00"
doc_updated_by: "agentctl"
description: "Align middleware, login route, and shared server Supabase client with the installed @supabase/ssr cookie get/set/remove API so login persists a server-readable session."
---
## Summary

Supabase SSR cookie wiring now uses get/set/remove, matching the installed @supabase/ssr 0.2.0 API so auth cookies are written and read by server routes.

## Scope

In scope: apps/web/src/app/api/auth/login/route.ts, apps/web/middleware.ts, and packages/lib/src/supabase/server.ts. Out of scope: Supabase project settings, database roles, and dashboard data shape changes.

## Risks

Moderate risk because the shared server Supabase adapter affects authenticated API routes and middleware. The change is constrained to the cookie method names used by the installed library and preserves existing route behavior.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert the cookie adapter changes in middleware, the login route, and the shared Supabase server helper.

