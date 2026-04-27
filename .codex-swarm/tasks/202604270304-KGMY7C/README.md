---
id: "202604270304-KGMY7C"
title: "Route editors away from advertiser dashboard"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "admin", "supabase"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: authenticated profile works; editor login was still routed to advertiser dashboard and schema-mismatched review queue returned 500." }
doc_version: 2
doc_updated_at: "2026-04-27T03:04:23+00:00"
doc_updated_by: "agentctl"
description: "After login, route editor and writer users by profile role and prevent the admin review queue from returning a 500 while the review article schema is absent."
---
## Summary

Login now routes editors to /admin and writers to /creator based on /api/profile. The admin queue returns an empty queue instead of 500 when the review-article schema is not present.

## Scope

In scope: apps/web/src/app/[locale]/login/page.tsx and apps/web/src/app/api/admin/articles/route.ts. Out of scope: full CMS schema migration and dashboard advertiser data repair.

## Risks

Low to moderate risk. Login redirects change by role, and the admin queue avoids exposing schema errors while still requiring editor authorization.

## Verify Steps

- ...

## Rollback Plan

Revert the login role-routing change and the admin queue schema fallback.

