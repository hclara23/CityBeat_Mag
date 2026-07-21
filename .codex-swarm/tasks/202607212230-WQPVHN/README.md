---
id: "202607212230-WQPVHN"
title: "Repair job board and navigation"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212201-F115P0"]
tags: ["frontend", "backend", "jobs", "firestore", "deployment"]
verify: ["npm run type-check", "npm run build"]
commit: { hash: "d3f13ab665061c4f316d5e362b156a380aee8a04", message: "🐛 WQPVHN repair job board index and navigation" }
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: repair the production Job Board query error, add a Jobs link to the main desktop and mobile navigation, deploy both changes, and verify them live." }
  - { author: "ORCHESTRATOR", body: "Start: reconcile production Firestore indexes, add the exact jobs query index and bilingual navigation entry, verify responsive rendering and builds, then deploy and smoke-test production." }
  - { author: "ORCHESTRATOR", body: "verified: Firestore jobs index CICAgOjXh4EK is READY | details: Cloud Run revision citybeat-web-00149-nrk is Ready with 100% traffic; English and Spanish homepages and Job Boards return 200 with localized Jobs navigation and no index error; 46 tests, type checks, and production build passed." }
doc_version: 2
doc_updated_at: "2026-07-21T22:46:06+00:00"
doc_updated_by: "agentctl"
description: "Fix the production Job Board Firestore index failure, add localized Jobs navigation to the shared header, verify the paid-job query and responsive navigation, deploy the index and web release, and capture production evidence."
---
## Summary

Repaired the production Job Board query with a tracked Firestore composite index and added localized Jobs and Empleos links to the shared desktop and mobile navigation.

## Context

The live /en/jobs page returns Firestore FAILED_PRECONDITION because its paid, unexpired, multi-sort query lacks a declared composite index. The shared SiteHeader currently omits Jobs from both desktop and mobile navigation. Production runs as Cloud Run service citybeat-web in kerstenblueprint/us-central1; current rollback revision is citybeat-web-00148-cjs.

## Scope

Declare and configure the exact jobs composite index; add localized Jobs and Empleos navigation through the shared navItems source used by desktop and mobile menus; add focused regression coverage where practical; run typecheck and production build; deploy the Firestore index and Cloud Run source; verify the index reaches READY, the public Job Board no longer exposes an error, and navigation links resolve correctly.

## Risks

Firestore indexes build asynchronously, so the web release can still show FAILED_PRECONDITION until the index becomes READY. Adding another desktop nav item can crowd narrower layouts. The change reuses existing header styles and deployment waits for index readiness before final production verification.

## Verify Steps

Run npm run type-check and npm run build. Validate firebase.json and firestore.indexes.json. Confirm the deployed jobs index is READY. Confirm /en/jobs and /es/jobs return 200 without FAILED_PRECONDITION or the index creation URL, and confirm the rendered header contains localized links to /en/jobs and /es/jobs on the shared responsive navigation.

## Rollback Plan

Route Cloud Run traffic back to citybeat-web-00148-cjs if the web revision is unhealthy. The new Firestore index is additive and can remain safely; if necessary it can be removed later through the tracked index configuration after confirming no query depends on it.

## Notes

User approved implementation and production deployment on 2026-07-21. Pre-deployment verification passed: Firestore index JSON validation, Firebase production-project dry run, 46 automated tests, all four TypeScript package checks, and the full Next.js production build with 102 generated static pages. The frontend-design guidance kept the change within the existing CityBeat editorial header system by reusing the shared navItems source and established typography, spacing, localization, desktop, and mobile behavior. Firestore jobs index CICAgOjXh4EK reached READY with fields is_paid ASC, expires_at DESC, created_at DESC. Cloud Run revision citybeat-web-00149-nrk became Ready at 2026-07-21T22:44:53Z and serves 100% of traffic; rollback target is citybeat-web-00148-cjs. Production /en, /es, /en/jobs, and /es/jobs returned 200, exposed the correct localized Jobs navigation, and contained no FAILED_PRECONDITION, index requirement, or create-composite error. No secret values were printed or written.

