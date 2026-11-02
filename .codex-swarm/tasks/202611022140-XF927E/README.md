---
id: "202611022140-XF927E"
title: "Enrich Integrity and Case apartment portfolios"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "b2b641a85d90fd7393136126fc9ba02d80f6ca64", message: "✨ XF927E start: Enrich 69 Integrity and Case listings with bilingual details, 147 sourced photos, verified website destinations and address-confirmation notes | details: add Foxglove and preserve claim identities. Validate 138 localized detail pages, four corporate portfolios and 38 claim/content/billing tests. Publication pending deployment-cost approval." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Enriched 69 local Integrity and Case entries; completing preview verification and preparing publication approval." }
  - { author: "ORCHESTRATOR", body: "start: Enrich 69 Integrity and Case listings with bilingual details, 147 sourced photos, verified website destinations and address-confirmation notes | details: add Foxglove and preserve claim identities. Validate 138 localized detail pages, four corporate portfolios and 38 claim/content/billing tests. Publication pending deployment-cost approval." }
  - { author: "ORCHESTRATOR", body: "verified: published 69 Integrity and Case listings with 147 sourced photos and bilingual details | details: all 138 live detail pages, four company portfolios and production health checks passed." }
doc_version: 2
doc_updated_at: "2026-11-02T22:17:01+00:00"
doc_updated_by: "agentctl"
description: "Verify local portfolios and enrich every Integrity and Case apartment entry with source-backed bilingual details, official photos and website links while preserving claim identities and manager edits."
---
## Summary

Enrich all local Integrity and Case community entries with bilingual researched content and official imagery, preserving manager edits and claim workflow.

## Context

User requested the same source-backed bilingual enrichment already published for RPM/M7. Official management directories identify 60 Integrity entries, including newly added Foxglove, and 9 Case entries. Research artifacts retain observed URLs, image provenance and factual limitations.

## Scope

Enrich 60 Integrity and 9 Case entries with bilingual summaries, highlights, observed floorplan/gallery links and 147 official-site photos across 68 entries. Add Foxglove; update verified website destinations. Render bilingual address-discrepancy notes. Preserve all existing claim contacts, approved manager overrides and previous RPM/M7 enrichment. No production data writes, live SMS, payments or outreach.

## Risks

Shared official sites may represent more than one community. Do not silently merge identities or transfer images between properties. Preserve claim phone numbers and approved manager edits. External photo availability and rights are not guaranteed; retain source links and flag gaps. Publication requires a new approved deployment budget.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web. Passed 38 targeted tests across apartment-enrichment, apartments, apartment-claim-flow and property-portfolio-flow; real claim handlers tested with isolated providers for all 98 catalog records in English and Spanish. All 147 new photo URLs fetched and decoded; contact sheets visually reviewed. Isolated HTTP preview passed all 138 new localized detail routes, asserting summaries, photos, website labels/URLs, claim links and discrepancy notes. Browser verified loaded Case English and Integrity Spanish photos, website/claim controls, and Spanish mobile layout at 390x844 with no horizontal overflow. Existing RPM/M7 enrichment and existing Integrity claim phones/addresses compare unchanged to HEAD. No production claim or payment executed.

## Rollback Plan

Revert the task implementation before publishing, or restore the preceding production revision through the normal deployment workflow. No live database mutations planned.

## Notes

Published approved commit b2b641a through successful GitHub run41534134963: https://github.com/hclara23/CityBeat_Mag/actions/runs/41534134963 . Cloud Build0b6427e4-d599-46c7-bc2b-e3c734b3c31d succeeded from2026-11-02T22:07:35Z to22:14:33Z. Cloud Run citybeat-web-00471-lur serves100percent traffic. User approved up to USD1; one build ran, actual billing not finalized. EPT TRE remains without photos due to unresolved Santi identity/address mapping; Villa Victoria uses labeled shared-site imagery. E11even address and Kansas ZIP conflicts remain visible in bilingual notes. Summerstone lacks a floorplan link; The501 lacks a separate gallery link. No live claims, texts, outreach or card charges.

## Changes Summary

Published 69 enriched local listings: Integrity60 and Case9, including Foxglove;147official-site photos across68entries,66floorplan links and66gallery links. All138localized detail pages passed both preview and public-site checks. All4company portfolio pages passed expected60/9counts in both languages. Browser confirmed live English Case and Spanish Integrity photos and website/claim controls. Saved case-enriched-live.png and integrity-enriched-es-live.png. Production health and payment health returned200. CI audit, full tests, candidate checks and live checks succeeded. Existing claim identities and manager edits preserved.

