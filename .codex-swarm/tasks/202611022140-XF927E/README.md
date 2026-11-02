---
id: "202611022140-XF927E"
title: "Enrich Integrity and Case apartment portfolios"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Enriched 69 local Integrity and Case entries; completing preview verification and preparing publication approval." }
  - { author: "ORCHESTRATOR", body: "start: Enrich 69 Integrity and Case listings with bilingual details, 147 sourced photos, verified website destinations and address-confirmation notes | details: add Foxglove and preserve claim identities. Validate 138 localized detail pages, four corporate portfolios and 38 claim/content/billing tests. Publication pending deployment-cost approval." }
doc_version: 2
doc_updated_at: "2026-11-02T21:59:49+00:00"
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

EPT TRE remains distinct and has no assigned photos because its management-directory link identifies Santi at another address. Villa Victoria photos explicitly identify their shared official website. E11even address and Kansas ZIP conflicts are shown in bilingual verification notes. External photos retain source attribution and can become unavailable; the existing gallery handles failures. No image license is asserted. Summerstone lacks an exposed floorplan link; The 501 lacks a separate gallery link. Prior production revision: citybeat-web-00469-fir. Publication awaits new approval for up to USD1 in Google Cloud deployment usage.

## Changes Summary

Prepared 69 enriched local listings: Integrity 60 and Case 9, including Foxglove. Added 147 verified photos, 66 floorplan links and 66 gallery links. All 138 localized detail previews passed; all four company portfolio previews returned their expected 60/9 listing counts. A transient Next development module error cleared on rerun; both Case language routes then passed. Saved English Case and Spanish Integrity screenshots; mobile Spanish claim button is 48px tall without overflow. Preview processes stopped and generated configuration restored. Implementation ready for publication approval; no deployment performed.

