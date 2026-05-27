---
id: "202605272156-0FS3EJ"
title: "Fix dashboard and analytics table queries"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "backend", "frontend"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: modifying dashboard and analytics API routes to use the correct database schema." }
doc_version: 2
doc_updated_at: "2026-05-27T21:56:57+00:00"
doc_updated_by: "agentctl"
description: "Modify dashboard and analytics API routes to use correct ad_campaigns and ad_events database tables instead of non-existent campaigns and analytics tables"
---
## Summary

Corrected the table targets inside the dashboard and analytics API endpoints, migrating their PostgREST queries from the non-existent campaigns and analytics tables to the active ad_campaigns and ad_events tables.

## Scope

- Update apps/web/src/app/api/dashboard/route.ts to select from ad_campaigns and ad_events
- Update apps/web/src/app/api/analytics/route.ts to select from ad_campaigns and ad_events

## Risks

Low. Bypassing non-existent database relations and targeting correct schema tables ensures correct data retrieval for advertiser dashboards.

## Verify Steps

1. Ran npm run build successfully
2. Ran npm run type-check successfully
3. Ran npm run lint successfully

## Rollback Plan

Revert changes in apps/web/src/app/api/dashboard/route.ts and apps/web/src/app/api/analytics/route.ts to target campaigns and analytics tables.

