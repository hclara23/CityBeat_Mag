---
id: "202610310716-BECXY5"
title: "Improve directory discovery and owner performance experience"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "652df721098e5e3195d84585b58a834f6799ce69", message: "🚧 BECXY5 start: implement directory filters, owner listing actions and source-specific analytics with regression tests | details: retain pending isolated browser verification before release." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved directory navigation, source-specific analytics and owner listing actions using existing features and permissions. Local tests only; no deployment yet." }
  - { author: "ORCHESTRATOR", body: "start: implement directory filters, owner listing actions and source-specific analytics with regression tests | details: retain pending isolated browser verification before release." }
  - { author: "ORCHESTRATOR", body: "verified: directory filters, mobile bilingual layout, owner progress links and source-consistent analytics pass local browser checks and production verification through Y3EHBA | details: final release has 1,038 passing tests and preserves customer content." }
doc_version: 2
doc_updated_at: "2026-10-31T09:15:58+00:00"
doc_updated_by: "agentctl"
description: "Approved: simplify category/city navigation and mobile filters; selectable GA4/Cloudflare reporting with data limitations; actionable listing completion and preview/performance controls; verify EN/ES customer journeys locally before any deployment. No subagents or new paid services."
---
## Summary

Approved four-part usability improvement: directory filtering and compact browse guides; selectable reporting with limits; actionable owner listing management; local bilingual responsive journey verification.

## Context

Approved four-part improvement plan. User subsequently requested a read-only repository assessment and clarified the service area as El Paso, Horizon, Canutillo, Socorro, Clint, Sierra Blanca, Fabens, Anthony, Las Cruces, Santa Teresa, and Sunland Park. No subagents, installations, paid services, or deployment in this work.

## Scope

Reuse existing APIs and entitlements. Keep SEO links crawlable and payment/account protections intact. No subagents, new services, production data writes or deployment.

## Risks

Avoid misleading capped analytics, stale range responses, and suggesting locked fields to Basic owners. Verify hash links and keyboard/mobile interactions. Existing customer data must not be mutated during tests.

## Verify Steps

Run focused unit tests, complete regression suite, TypeScript and local production build. Exercise bilingual public directory and authenticated UI fixtures locally at mobile and desktop sizes; distinguish mocked tests from live customer flows.

## Rollback Plan

Revert this task commit before deploying. Current production remains unchanged until a separately approved deployment.

## Notes

DONE: source 652df72 included in release ef8c6be, live citybeat-web-00467-zuj through deployment task Y3EHBA. Local production desktop/mobile EN/ES checks pass: category/city filters, removable chips, empty state and recovery, owner completion actions and profile/analytics deep links. Synthetic authenticated fixtures exercise owner progress and data table. Live staff verification confirms GA4 and Cloudflare reporting, source-consistent chart/totals, unavailable user/session values for Cloudflare and capped first-party notice. No owner listing content changed; 1,038 regression tests and final build pass.

