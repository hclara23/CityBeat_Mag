---
id: "202604191843-107AM1"
title: "Simplify main header navigation"
status: "DONE"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["ui", "nav"]
verify: ["npm run type-check", "npm run lint", "npm run build"]
commit: { hash: "2d82ecf5a63c5e2da57d7334a81afe67dcc586bd", message: "🧭 107AM1 simplify main header navigation" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: remove Ads Write and Studio from the main CityBeat header navigation." }
  - { author: "ORCHESTRATOR", body: "Start: update SiteHeader nav items and verify." }
  - { author: "ORCHESTRATOR", body: "verified: removed Ads Write and Studio from the main header navigation and passed npm run type-check, npm run lint, and npm run build." }
doc_version: 2
doc_updated_at: "2026-04-19T18:45:24+00:00"
doc_updated_by: "agentctl"
description: "Remove Ads, Write, and Studio links from the CityBeat main top navigation while keeping the remaining menu links, locale switcher, and Advertise CTA."
---
## Summary

Removed Ads, Write, and Studio from the CityBeat main header navigation. The remaining top menu links are Stories, Events, Directory, and Submit, with the language switcher and Advertise CTA unchanged.

## Scope

Updated apps/web/src/components/citybeat/SiteHeader.tsx only for runtime UI. Task tracking artifacts were updated through agentctl. Existing unrelated .env.production.template and src/lib/articles and media changes were left untouched.

## Risks

Low risk. This removes only header navigation entries; the underlying Ads, Creator, and Studio routes remain available by direct URL or other CTAs.

## Verify Steps

npm run type-check passed. npm run lint passed. npm run build passed.

## Rollback Plan

Revert this task commit to restore Ads, Write, and Studio in the main header nav.

