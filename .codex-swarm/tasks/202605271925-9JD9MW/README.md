---
id: "202605271925-9JD9MW"
title: "Troubleshoot editor login failure"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "frontend", "production"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: production login hangs because the Supabase host no longer resolves and the admin review route also shows a React client runtime error." }
doc_version: 2
doc_updated_at: "2026-05-27T19:27:21+00:00"
doc_updated_by: "agentctl"
description: "Diagnose production editor login failure, improve auth error handling, and fix the admin review page client runtime issue found during investigation."
---
## Summary

Production troubleshooting found that the configured Supabase project hostname returns NXDOMAIN, so login cannot authenticate until the Supabase project/env is restored. The app will be updated to report this clearly and the admin review route will be adjusted for the app's Next/React version.

## Scope

In scope: auth login API error mapping, login page request timeout/error handling, and admin review page route params compatibility. Out of scope: creating or restoring the Supabase project, rotating credentials, or changing Vercel env values without current Supabase project keys.

## Risks

Low code risk. These changes do not alter successful authentication behavior; they make unreachable-auth failures explicit and remove an incompatible client route parameter usage.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed. Production DNS check currently shows czhttphmcgrsxvsiakha.supabase.co as NXDOMAIN, so auth cannot fully succeed until Supabase/Vercel env is corrected.

## Rollback Plan

Revert the login API, login page, and admin review page changes if they cause unexpected runtime behavior after deployment.

## Notes

Root cause evidence: direct DNS lookup and curl both failed to resolve czhttphmcgrsxvsiakha.supabase.co, while supabase.com resolved. The live login API returned 401 with fetch failed before a credential-specific Supabase error could occur.

