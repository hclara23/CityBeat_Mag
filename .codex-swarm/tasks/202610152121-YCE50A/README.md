---
id: "202610152121-YCE50A"
title: "Expand compliant Southwest business source templates"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610152121-B8B5RR"]
tags: ["code", "ingestion", "open-data"]
verify: ["npm test"]
commit: { hash: "01d0e3c93495c8471b9ff66d30d5ec7689d289b3", message: "✨ YCE50A add review-first official Southwest business feeds" }
comments:
  - { author: "CODER", body: "Start: inventory current free official feeds; add Southwest high-claim category templates with provenance and geographic filters; avoid paid AI and restricted map content." }
  - { author: "ORCHESTRATOR", body: "Verified: official-source expansion is review-first; 650 tests and the web TypeScript check pass, with no paid API call or production write." }
  - { author: "CODER", body: "verified: official Southwest feeds remain disabled and review-first | details: 650 tests and web type-check passed without paid API calls or production writes." }
doc_version: 2
doc_updated_at: "2026-10-15T21:27:49+00:00"
doc_updated_by: "agentctl"
description: "Add and document free official/open-data sources for high-claim categories across El Paso County, Southern New Mexico, and West Texas, with provenance, freshness, geographic filtering, and deterministic deduplication. Do not use paid APIs or restricted Google/Bing content."
---
## Summary

Added four free official-data expansion templates for West Texas electrical contractors, beauty establishments, childcare operations, and hospitality businesses. Expanded the directory region filter to West Texas and southern New Mexico while keeping every new feed disabled and review-first.

## Scope

Added TDLR, Texas HHS, and TABC templates backed by data.texas.gov. New templates import unpublished candidates only, retain regional filtering and consolidation, and never invoke Google Places or paid AI. Added West Texas and southern New Mexico cities and ZIP ranges to regional validation plus regression tests.

## Risks

Official datasets can contain stale, duplicate, closed, or incomplete records. Templates remain disabled and Publish=false so an operator must dry-run, review, deduplicate, and explicitly approve publication. No paid service or production mutation was triggered.

## Verify Steps

Run npm test from the repository root; run npm --prefix apps/web run type-check; run git diff --check. Confirm all four southwest expansion templates are disabled, contain no SEARCH_GOOGLE_PLACES node, use data.texas.gov, and deliver with Publish=false.

## Rollback Plan

Revert the implementation commit. This removes the four templates and restores the prior regional city and ZIP allowlist; no production data needs rollback because the templates were not enabled or run.

## Notes

Verified against live official Socrata schemas for TDLR dataset 7358-krk7, HHS dataset bc5r-88dy, and TABC dataset 7hf9-qc9f. Full suite: 630 web tests plus 20 package tests passed; TypeScript type-check passed.

