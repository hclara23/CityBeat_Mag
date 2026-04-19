---
id: "202604191815-AN10NV"
title: "Fix audited app issues"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202604191801-VWASZY"]
tags: ["bugfix", "nextjs"]
verify: ["npm run type-check", "npm run lint", "npm run build"]
commit: { hash: "47a4e595e8f4f1180eaea64ee8c9eda3b55cb334", message: "🛠️ AN10NV fix audited app issues" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the audited fixes and verify with type-check lint and build." }
  - { author: "ORCHESTRATOR", body: "Start: patch lint auth billing ads routes checkout success schema stubs and image warnings." }
  - { author: "ORCHESTRATOR", body: "verified: fixed the audited lint auth billing ads checkout schema image and UI issues, then passed npm run type-check, npm run lint, and npm run build." }
doc_version: 2
doc_updated_at: "2026-04-19T18:32:22+00:00"
doc_updated_by: "agentctl"
description: "Fix the audit findings for lint configuration, auth middleware, missing billing customer portal route, ads locale routing, checkout and success flow consistency, SQL/schema drift, stubbed dashboard billing analytics data paths where safe, and image warnings."
---
## Summary

Fixed the audited app issues: restored ESLint compatibility, replaced the fragile auth cookie check with Supabase server session validation, added web dashboard/billing/customer-portal API routes, wired dashboard and billing pages to real API responses, localized web auth redirects, fixed ads locale middleware/navigation/checkout/success routing, repaired SQL RLS/index drift, replaced raw image previews with Next Image, and fixed a surfaced UI lint error.

## Scope

Touched app runtime files in apps/web, apps/ads, packages/ui, packages/lib schema SQL, infra SQL, package manifests/lockfile, and the root ESLint config. Left unrelated workspace changes in .env.production.template and src/lib/articles and media untouched.

## Risks

Live Stripe portal sessions, Supabase RLS behavior, and authenticated browser flows still depend on configured production secrets and database migrations being applied in the target environment. Static/build verification confirms the app compiles and routes exist, but it does not execute real payment or Supabase sessions.

## Verify Steps

npm run type-check passed. npm run lint passed. npm run build passed. Build output includes the new web /api/dashboard, /api/billing, /api/customer-portal routes and ads locale middleware/routes.

## Rollback Plan

Revert the implementation commit for this task to restore previous lint config, route behavior, SQL files, package manifests, and UI changes. No generated Graphify artifacts or unrelated environment/media files are part of this change.

