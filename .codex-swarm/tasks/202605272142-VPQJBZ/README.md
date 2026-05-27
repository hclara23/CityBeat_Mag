---
id: "202605272142-VPQJBZ"
title: "Consolidate login and profile queries"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "frontend", "production"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: beginning optimization of editor login flow by consolidating auth session and profile retrieval into a single fast API response." }
doc_version: 2
doc_updated_at: "2026-05-27T21:43:04+00:00"
doc_updated_by: "agentctl"
description: "Consolidate the auth sign-in and user profile queries into a single API response to fix the browser login timeout issue"
---
## Summary

Consolidated the auth sign-in API response and the user profile retrieval into a single atomic API network request to fix the browser login page hang/timeout issue.

## Scope

- Modify login route apps/web/src/app/api/auth/login/route.ts to return user profile roles
- Update login page apps/web/src/app/[locale]/login/page.tsx to read profile from login response

## Risks

Low. Consolidating the sequential API call improves robustness and avoids race conditions, keeping standard session behaviors intact.

## Verify Steps

1. Ran npm run build successfully
2. Ran npm run type-check successfully
3. Ran npm run lint successfully

## Rollback Plan

Revert the changes in login/page.tsx and auth/login/route.ts to restore separate login and profile requests.

