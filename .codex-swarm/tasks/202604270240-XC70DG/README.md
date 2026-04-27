---
id: "202604270240-XC70DG"
title: "Fix login session cookie handoff"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "supabase", "vercel"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: traced dashboard 401 after login to a missing server-visible Supabase session cookie." }
doc_version: 2
doc_updated_at: "2026-04-27T02:41:11+00:00"
doc_updated_by: "agentctl"
description: "Move password sign-in to a server route that writes Supabase auth cookies before redirecting users to the dashboard."
---
## Summary

Login now posts credentials to a server-side auth route so Supabase session cookies are written before navigating to the dashboard.

## Scope

In scope: apps/web/src/app/api/auth/login/route.ts and apps/web/src/app/[locale]/login/page.tsx. Out of scope: signup, password reset, dashboard data model changes, and Supabase schema changes.

## Risks

- ...

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert the server login route and restore the login page to call the browser Supabase signIn helper directly.

