---
id: "202606080931-AMD33X"
title: "Fix blank admin directory page"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: reproduce production blank admin directory page, trace client/API root cause, fix, and verify rendered behavior plus type/lint checks." }
doc_version: 2
doc_updated_at: "2026-06-08T09:37:12+00:00"
doc_updated_by: "agentctl"
description: "Debug and fix the blank page at /en/admin/directory, including rendered verification and local type/lint checks."
---
## Summary

Fixed the admin directory blank-page failure by replacing the unauthenticated null render with visible access-check and error states. The page now catches Supabase/profile verification failures and shows retry/sign-in actions instead of leaving the admin shell empty.

## Scope

Changed apps/web/src/app/[locale]/admin/directory/page.tsx only. The patch covers admin access verification, profile fetch error handling, directory fetch error notices, and gating filter-driven loads until admin access is confirmed.

## Risks

Low. Auth redirects are preserved for logged-out and unauthorized users. Admin users now see an error panel if profile verification fails, which may expose operational failures that were previously hidden as a blank page.

## Verify Steps

1. npm run lint --workspace @citybeat/web: passed. 2. npm run type-check --workspace @citybeat/web: passed. 3. Browser verification: production https://citybeatmag.co/en/admin/directory redirects logged-out users to /en/login with no console errors. 4. Browser verification: local http://localhost:3000/en/admin/directory redirects logged-out users to /en/login with visible content and no console errors.

## Rollback Plan

Revert the commit for task 202606080931-AMD33X to restore the prior directory admin component behavior. No database or environment changes were made.

