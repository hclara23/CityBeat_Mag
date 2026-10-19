---
id: "202610190548-H00E3Z"
title: "Audit CityBeat website and directory"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["audit", "frontend", "seo", "accessibility", "analytics", "security"]
verify: ["npm test"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: map the application architecture, inspect live English and Spanish user journeys, run automated quality checks, and report prioritized findings without changing production." }
doc_version: 2
doc_updated_at: "2026-10-19T05:57:25+00:00"
doc_updated_by: "agentctl"
description: "Perform a read-only evidence-backed audit of the live CityBeat website and repository across public UX, bilingual behavior, directory conversion flows, SEO, accessibility, analytics, performance, reliability, and security; deliver prioritized findings without modifying production."
---
## Summary

Read-only audit of the CityBeat public website, directory product, conversion paths, bilingual experience, SEO, accessibility, analytics, performance, reliability, and security.

## Scope

Map the codebase from the existing Graphify graph; inspect representative live English and Spanish pages on desktop and mobile; run repository tests and static checks; inspect metadata, structured data, tracking, authentication boundaries, and conversion flows; produce evidence-backed prioritized recommendations. No production mutations or purchases.

## Risks

Live results may vary by authentication, cache, third-party availability, and production data. The audit will distinguish verified defects from risks or recommendations and will avoid submitting forms, initiating payments, or editing external accounts.

## Verify Steps

Run npm test and applicable static/build checks; inspect live representative routes and response metadata; validate bilingual pages, directory phone/no-phone behavior, analytics hooks, robots and sitemap behavior, accessibility signals, and key API failure modes.

## Rollback Plan

No application or production changes are authorized. Remove only audit-generated local artifacts if requested; task documentation remains the audit record.

## Notes

Audit completed against the current Firebase/Cloud Run application only; retired Sanity paths were excluded. Evidence and prioritized findings are recorded in docs/audits/citybeat-site-audit-2026-10-18.md. No production behavior was changed or deployed.

