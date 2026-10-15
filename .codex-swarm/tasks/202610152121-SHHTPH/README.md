---
id: "202610152121-SHHTPH"
title: "Verify large-scale directory ingestion and publication"
status: "DONE"
priority: "high"
owner: "TESTER"
depends_on: ["202610152121-YCE50A", "202610152121-FR763D"]
tags: ["testing", "directory", "ingestion"]
verify: ["npm test", "npm run type-check"]
commit: { hash: "d2b7923735959615567c0332c58f26ba610e5fcb", message: "🧪 SHHTPH reject expired licenses and verify directory scale release" }
comments:
  - { author: "TESTER", body: "Start: verify official source templates, six-figure sitemap behavior, production build compatibility, and non-mutation guarantees before release." }
  - { author: "TESTER", body: "Verified: 652 tests, TypeScript, and the production build pass; official source checks were read-only, expired TDLR rows are now rejected, and no candidate was imported or published." }
  - { author: "TESTER", body: "verified: 652 tests, TypeScript, and production build pass | details: expired licenses are rejected and no production ingest or publication occurred." }
doc_version: 2
doc_updated_at: "2026-10-15T21:35:45+00:00"
doc_updated_by: "agentctl"
description: "Test provenance rejection, merge-chain safety, deduplication, sitemap scale, directory performance, and staged publication behavior before production release."
---
## Summary

Verified the duplicate-safe publication pipeline, official Southwest feeds, scalable sitemap routing, and production build. Added a run-time expiration gate after discovering the TDLR all-licenses dataset includes expired records.

## Scope

Validated all templates, official endpoint schemas and counts, review-first defaults, merged-record exclusions, 45,000-URL sitemap shards, robots discovery, TypeScript, the full automated suite, and a Next.js production build. Added deterministic MM/DD/YYYY and ISO minimum-date filtering to the JSON mapper and applied it to TDLR templates.

## Risks

The four official feeds expose about 3,007 gross candidates before expiration filtering and deduplication. Source records may still be incomplete or duplicated, so templates remain disabled and publish=false. Production verification must confirm sitemap responses and dry-run each feed before any candidate import.

## Verify Steps

Run npm test: 632 web tests and 20 package tests pass. Run npm --prefix apps/web run type-check. Run npm run build and confirm Next.js emits /sitemap.xml plus /directory/sitemap/0.xml. Query official source counts read-only and verify no directory write occurred.

## Rollback Plan

Revert the verification hardening commit to remove the mapper date gate. The prior templates remain disabled and unpublished, so no production data rollback is required.

## Notes

Read-only source counts on 2026-10-15: TDLR electrical 335, TDLR beauty 1,022, HHS childcare 205, TABC hospitality 1,445. These are gross rows before the new expiration gate, regional validation, identity deduplication, and publication audit. No feed was run and no production record was changed.

