---
id: "202606031802-PRFFQ1"
title: "Fix TypeError during cookie parsing on login"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "backend", "frontend"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "05cc91ae800e9dd1900fa18f86c4420648233c03", message: "🐛 PRFFQ1 fix: parse NextRequest cookies instead of custom header split | details: use request.cookies.get utility which decodes URL-encoded session strings automatically, avoiding string-handling crash in Supabase SSR library." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: refactor login route to use standard NextRequest cookies. This avoids TypeError crash due to URL-encoded cookie parsing." }
  - { author: "ORCHESTRATOR", body: "verified: all local verification tests passed successfully, including typescript checking, linting, and build commands. | details: The built bundle compiled without any errors." }
doc_version: 2
doc_updated_at: "2026-06-03T18:03:21+00:00"
doc_updated_by: "agentctl"
description: "Refactor login route to use standard NextRequest cookies retrieval to prevent TypeError crash on URL-encoded cookie strings during authentication."
---
## Summary

Refactored the /api/auth/login route in apps/web/src/app/api/auth/login/route.ts to retrieve cookie values using standard, built-in NextRequest.cookies.get(name)?.value rather than a manual header string-split. Next.js automatically handles URL-decoding, preventing the TypeError: Cannot create property 'user' on string crash when Supabase SSR library receives URL-encoded session strings.

## Scope

Modifies apps/web/src/app/api/auth/login/route.ts to use NextRequest.cookies instead of parsing raw headers.

## Risks

Low risk. Leverages standard Next.js cookie utility functions instead of a custom cookie string splitter.

## Verify Steps

Run: 1. npm run type-check --workspace=@citybeat/web, 2. npm run lint --workspace=@citybeat/web, 3. npm run build --workspace=@citybeat/web. All compilation checks and builds must pass successfully.

## Rollback Plan

Revert the commit to restore the previous custom header cookie parsing logic in apps/web/src/app/api/auth/login/route.ts.

