---
id: "202605271948-W9R94Z"
title: "Harden browser login after Supabase restore"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "frontend", "production"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: terminal verification shows production auth succeeds quickly, but the browser login page can still time out after Supabase restore." }
doc_version: 2
doc_updated_at: "2026-05-27T19:49:35+00:00"
doc_updated_by: "agentctl"
description: "Increase login/profile request timeout and return stage-specific browser errors so restored Supabase projects do not leave editor login in an ambiguous timeout state."
---
## Summary

Production API checks confirmed editor login works, but the browser can still time out after the Supabase restore. The login page now uses a longer timeout and reports whether sign-in or profile loading timed out.

## Scope

In scope: login page timeout duration and stage-specific error handling. Out of scope: Supabase project recovery and Vercel environment variable changes, which were already restored.

## Risks

Low risk. Successful login behavior is unchanged; only timeout thresholds and browser-facing error text changed.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed. Production API login returned 200 OK from terminal before this UI hardening.

## Rollback Plan

Revert the login page timeout and error handling changes if they cause unexpected browser behavior.

## Notes

Live API evidence: /api/auth/login returns 200 OK and /api/profile responds quickly with the admin/editor/writer profile. Browser timeout is likely stale client bundle/cache or transient post-restore latency.

