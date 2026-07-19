---
id: "202607191856-GFQKDZ"
title: "Remove This Weekend menu link"
status: "TODO"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "nav"]
verify: ["npm run type-check --workspace @citybeat/web"]
doc_version: 2
doc_updated_at: "2026-07-19T18:56:44+00:00"
doc_updated_by: "agentctl"
description: "Remove the This Weekend/Este finde entry from the shared CityBeat main navigation on desktop and mobile while preserving the underlying page route."
---
## Summary

Remove the bilingual This Weekend navigation entry from the shared CityBeat site header.

## Context

The main menu currently links to /this-weekend as This Weekend in English and Este finde in Spanish. The requested change is menu-only.

## Scope

Update apps/web/src/components/citybeat/SiteHeader.tsx so the shared desktop and mobile navigation arrays omit /this-weekend. Preserve the route and page content.

## Risks

Low risk. Removing the shared array entry affects both desktop and mobile menus in both locales; direct links to the page remain available.

## Verify Steps

Run npm run type-check --workspace @citybeat/web. Inspect the SiteHeader diff and confirm no /this-weekend nav item remains.

## Rollback Plan

Restore the bilingual /this-weekend object at the start of getNavItems and rerun the web type-check.

## Notes

User-approved plan: remove only the main-menu link, not the This Weekend page or related social content.

