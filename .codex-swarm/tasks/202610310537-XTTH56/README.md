---
id: "202610310537-XTTH56"
title: "Connect existing CityBeat GA4 and Business Profile reporting"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Approved existing-property link and Viewer access completed; implementing isolated platform performance reporting and local verification." }
  - { author: "ORCHESTRATOR", body: "Blocked: Google accepted API allowlist application, case 5-6813000042325, with estimated 7-10 business day review. User confirmed profile verified 60+ days. Await Google approval before direct performance activation; GA4 reporting is already live." }
doc_version: 2
doc_updated_at: "2026-10-31T05:47:01+00:00"
doc_updated_by: "agentctl"
description: "Approved: link City Beat Magazine to existing property 542822471, grant runtime service account Viewer, correct and verify scoped dashboard GBP reporting. No new property, no subagents, no paid deployment authorized. Related tasks 202610162338-5Y02T0 and 202610162356-3PD2Z6."
---
## Summary

Connect City Beat Magazine to the existing GA4 property and repair platform performance reporting without creating a property or using subagents.

## Context

User approved the native GA4 link, Viewer grant, dashboard implementation, and free Google API setup/terms. No paid deployment is approved for this task. Related work: 202610162338-5Y02T0 and 202610162356-3PD2Z6.

## Scope

Native Google Business Profile link to GA4 property 542822471 (account 398927462), property Viewer for 854761587817-compute@developer.gserviceaccount.com, platform-only OAuth route and UI, nested performance parser, explicit error states and impressions labels. Advertiser connections remain separate.

## Risks

Direct Business Profile API quota is confirmed zero in Google Cloud. API allowlisting and OAuth configuration/authorization are still required before live performance can work. No credentials are stored in source. The broader business.manage scope is required by Google but the platform flow only reads profile data. New code is local and not deployed.

## Verify Steps

Passed npx tsc --noEmit, 9 targeted analytics tests, npm test (1000 total tests), npm run build --workspace @citybeat/web, and git diff --check. Local built server GET /api/admin/google-business and /api/admin/traffic-analytics each returns 401 without authentication. Production Finance seven-day GA4 report now shows 756 views, 261 active users, 286 sessions, 20% engagement and 51s average session. Google UI confirms LINK CREATED and runtime identity Viewer access.

## Rollback Plan

Revert the scoped implementation commit if necessary. Remove only the runtime service account Viewer grant or City Beat Magazine GA4 product link in Google Admin if requested. Disconnecting the platform connection deletes only platform_google_business_connections/citybeat and leaves advertiser connections and GA4 tracking intact.

## Notes

On October 30, 2026 (America/Denver), owner confirmed City Beat Magazine has been verified for at least 60 days. Submitted the existing project 854761587817 for Business Profile API allowlisting under morningstarelp@gmail.com. Google confirmed case 5-6813000042325 and estimates 7-10 business days; do not submit duplicate requests. Three free APIs enabled. Direct performance remains blocked on Google approval and subsequent OAuth configuration/authorization and deployment. Native GA4 link and live GA4 reporting remain working. Implementation commit 4d2a6af; no new property, spend, paid deployment or subagents.

