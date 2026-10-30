---
id: "202610302249-M5S972"
title: "Add bilingual apartments directory with RPM communities"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
comments:
  - { author: "CODER", body: "Start: build bilingual apartments directory and verified RPM catalog using existing CityBeat navigation and design tokens." }
  - { author: "CODER", body: "start: add bilingual apartment directory and ten verified RPM community profiles | details: details: match directory finder and cards; add search and ZIP and property-type filters, leasing contacts, sources, SEO and navigation; pass typecheck and three regression tests" }
doc_version: 2
doc_updated_at: "2026-10-30T22:53:38+00:00"
doc_updated_by: "agentctl"
description: "Approved apartments section matching the business directory in English and Spanish, with all ten verified RPM Living El Paso communities, searchable cards and details, navigation and tests. Prepare release; additional paid deployment requires approval."
---
## Summary

Add an English and Spanish Apartments directory and ten source-verified RPM Living community profiles, matching the existing business directory finder, cards, navigation and design tokens.

## Context

The user approved all ten El Paso properties from RPM Living's official community directory. Shared management does not establish shared ownership. TerraLane is correctly described as single-family rental homes rather than apartments.

## Scope

Source catalog in apps/web/src/lib/apartments.ts; bilingual index and detail routes under /[locale]/apartments; name/address/amenity search, ZIP and community-type filters, leasing phone/site/map links, management/source disclosures, metadata and structured data. Header, footer, business-directory cross-link and public sitemap include the section. Catalog records are bundled public editorial content and do not duplicate Firestore business records or manufacture owner claims. Existing contact page handles correction requests.

## Risks

Prices and availability are intentionally not represented because they change. Official source contact numbers can be tracking lines. The catalog requires future editorial updates when property management or contact details change. No copied photography or invented ratings are used. Publishing requires a separately authorized deployment budget; no production write or push is performed here.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web. Passed node --import tsx --test apps/web/src/lib/apartments.test.ts (3 tests: complete unique bilingual catalog and valid contacts; accent-insensitive combined search and ZIP filtering; rental homes excluded from apartment-only filter). Passed git diff --check. Local preview running on port 3010 for parent browser review, including EN/ES indexes and property details.

## Rollback Plan

Revert the implementation commit and redeploy through the existing workflow with approved spending. No database migration or record deletion is required.

## Notes

Primary management/contact source: https://rpmliving.com/find-a-community-post-search/, checked October 30, 2026. Individual official community websites substantiate concise amenities where verified. Desert Commons East uses only verified catalog details. Review and release remain with the parent orchestrator; task remains DOING.

