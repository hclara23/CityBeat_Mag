---
id: "202610162338-5Y02T0"
title: "Add vendor traffic analytics to Finance dashboard"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["analytics", "finance", "frontend", "backend", "deployment"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm test", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: user approved the Finance & Analytics traffic dashboard, read-only Google and Cloudflare integrations, guarded deployment, and one Google Cloud Build charge capped at ." }
doc_version: 2
doc_updated_at: "2026-10-16T23:38:29+00:00"
doc_updated_by: "agentctl"
description: "Add protected Editor/Developer traffic and performance reporting from Google Analytics 4, Cloudflare Web Analytics, and CityBeat first-party analytics to the existing Finance & Analytics page; configure read-only integrations where available; test permissions, normalization, degraded states, and deploy through the guarded pipeline with the explicitly approved one-time Cloud Build charge capped at  and no new recurring service expense."
---
## Summary

Add a protected traffic-performance section to Finance & Analytics for Editor and Developer users, combining Google Analytics 4, Cloudflare Web Analytics, and first-party CityBeat pageview data without exposing provider credentials.

## Scope

Implement normalized provider adapters, a protected aggregation API, date-range controls, KPI cards, trends, top pages, acquisition and geography/device performance, provider health and degraded states, permission and normalization tests, production configuration, guarded deployment, and live verification.

## Risks

Vendor reporting credentials may be absent or lack property access; vendor APIs can be delayed or temporarily unavailable; provider definitions differ. The dashboard must label each source, never merge unlike metrics deceptively, keep credentials server-only, enforce Editor/Developer plus MFA, and retain first-party fallback.

## Verify Steps

Run web TypeScript checking, all automated tests, optimized production build, anonymous access smoke tests, Editor/Developer UI verification, candidate checks, public-domain checks, and provider status verification.

## Rollback Plan

Route Cloud Run traffic back to the previously serving revision. Vendor adapters fail independently, so credentials can also be removed or rotated without breaking finance data or first-party analytics.

## Notes

User approved one deployment build up to . No recurring paid service is authorized. Google Analytics Data API and Cloudflare GraphQL reporting will be read-only.

