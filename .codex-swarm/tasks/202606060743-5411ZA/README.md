---
id: "202606060743-5411ZA"
title: "Harden login during Supabase timeouts"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: harden the login API timeout path after production Supabase Auth and REST calls returned 522 responses during editor sign-in." }
doc_version: 2
doc_updated_at: "2026-06-06T07:45:05+00:00"
doc_updated_by: "agentctl"
description: "Return a controlled outage response from the login API when Supabase Auth or profile lookup hangs, so editor login does not remain stuck while the Supabase project data plane is unavailable."
---
## Summary

Add bounded timeout handling to the production login API so Supabase Auth or profile lookup stalls return a controlled JSON outage response instead of leaving the editor login flow waiting on a slow upstream.

## Scope

- ...

## Risks

This does not repair Supabase project availability. Users will still be unable to sign in while Supabase returns 522, but the app now surfaces a clear outage message. Timeout values may need tuning if Supabase is healthy but unusually slow.

## Verify Steps

Ran npm run type-check --workspace @citybeat/web and npm run build --workspace @citybeat/web. Also verified direct Supabase fake auth requests still return 522, confirming the remaining blocker is upstream project availability.

## Rollback Plan

Revert the login route timeout wrapper commit if it causes regressions. The previous route can still authenticate when Supabase is healthy, but it may wait until the platform timeout during upstream 522 conditions.

