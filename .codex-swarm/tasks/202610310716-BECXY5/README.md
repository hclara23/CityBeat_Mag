---
id: "202610310716-BECXY5"
title: "Improve directory discovery and owner performance experience"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement approved directory navigation, source-specific analytics and owner listing actions using existing features and permissions. Local tests only; no deployment yet." }
  - { author: "ORCHESTRATOR", body: "start: implement directory filters, owner listing actions and source-specific analytics with regression tests | details: retain pending isolated browser verification before release." }
doc_version: 2
doc_updated_at: "2026-10-31T08:47:50+00:00"
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

Local production browser checks pass for compact desktop/mobile directory filters, active filter removal, empty-state recovery, and Spanish layout without horizontal overflow. Local owner dashboard progress links and source-consistent traffic selector/table verified with synthetic fixtures; capped first-party data disclosure appears. Awaiting combined release and live verification.

