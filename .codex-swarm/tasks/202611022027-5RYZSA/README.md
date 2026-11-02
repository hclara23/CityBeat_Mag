---
id: "202611022027-5RYZSA"
title: "Enrich RPM and M7 apartment listings and website links"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: enrich29local RPM and M7 entries with bilingual sourced content and69photo references | details: add website buttons and safe destinations across listing tiers; preserve manager edits and claim contacts; verify58localized pages and mocked claim flows" }
  - { author: "ORCHESTRATOR", body: "start: include researched apartment data, gallery and Census components | details: add safe website URL normalization and manager-override regression tests" }
doc_version: 2
doc_updated_at: "2026-11-02T20:38:55+00:00"
doc_updated_by: "agentctl"
description: "Research official local portfolios, enrich bilingual property listings with attributed facts and imagery where reusable, label official area context, and expose clear website buttons for all listing tiers. Preserve claim identity and manager edits."
---
## Summary

Enrich the 29 local RPM and M7 apartment records and add prominent bilingual website buttons across business tiers and rentals.

## Context

User requested complete researched listings before manager claims, including photos, property facts and demographic context. Scope remains local El Paso portfolios.

## Scope

Official portfolio and property-site research,69 remote source-credited photos for27records, EN/ES descriptions and amenities, floorplan/gallery links, company and directory card imagery, official Census county context. Website CTAs on basic and paid business detail views; safe URL normalization and referral tracking retained. Existing claim identities and numbers preserved. Approved manager descriptions/photos override research.

## Risks

Two M7 records lack verified imagery: Amigos del Sol and Lee Place. Lee Place website is Coming Soon. M7 combined groups retained until distinct addresses verified; Monterrey Gardens six constituents identified in public copy. Phone/address source discrepancies documented, not silently changed. Third-party photo availability and reuse rights are not guaranteed. County context must not be represented as resident or ZIP demographics. Deployment requires fresh spending approval.

## Verify Steps

PASS local type check and git diff check. PASS22 apartment catalog/claim/outbound tests, plus7 enrichment/outbound tests (4 overlap); SMS mocked, no actual texts. PASS all69 source images retrieved and visually inspected on contact sheets. PASS all58localized rendered detail routes. Browser English ALZA and Spanish Cimarron show loaded photos and correct website destinations. Spanish mobile390px content375px without overflow. Manager photo overrides and clearing galleries tested. Isolated preview used loopback database stub and dummy auth credentials, then stopped. Generated Next configuration changes restored.

## Rollback Plan

Revert task implementation commit before deployment; if deployed restore previous known-good Cloud Run revision through normal deployment workflow. No live records or claims modified.

## Notes

Research provenance in rpm-research.json, m7-research.json and m7-locator-observed.json. Image fetch evidence in image-checks.json. Census source https://www.census.gov/quickfacts/elpasocountytexas checked2026-11-02; population2025 and ACS2020-2024 estimates. No API key signup, paid service, live SMS, outreach or card charge.

