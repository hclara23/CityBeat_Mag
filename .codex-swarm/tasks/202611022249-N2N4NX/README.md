---
id: "202611022249-N2N4NX"
title: "Research and enrich Haggerty rental communities"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: research verified three apartment-building candidates from Haggerty official vacancy feeds; prepare address-based bilingual entries with explicit unit-specific provenance and no claims of complete portfolio coverage." }
  - { author: "ORCHESTRATOR", body: "start: add three source-backed Haggerty apartment-building listings with nine photos, bilingual unit-specific details and website links | details: retain review-gated claims and shared corporate profile. Prevent El Paso County context on New Mexico listings and verify six localized pages, two portfolio pages and distinct shared-contact claims. Publication awaits deployment-cost approval." }
doc_version: 2
doc_updated_at: "2026-11-02T22:56:23+00:00"
doc_updated_by: "agentctl"
description: "Verify Haggerty Company and Century21 Haggerty apartment-community portfolios, add only source-confirmed community listings with bilingual details, official photo provenance and website/claim links, and document incomplete inventory."
---
## Summary

Verify both Haggerty rental operations and prepare source-backed bilingual apartment-community entries without implying a complete managed portfolio.

## Context

Continuation of the existing approved directory enrichment workflow. User requested Haggerty Company and Century21 Haggerty apartment complexes and rental communities, excluding individual homes and duplexes. Official regional sites share an AppFolio feed; the existing combined Haggerty company ID and alias are preserved, without asserting a legal entity merger.

## Scope

Add three address-based apartment-building entries:8636Lawson in ElPaso,1402S Espina and1705Payne triplex in LasCruces. Nine official photos, bilingual summaries/layouts/unit-specific amenities, website links and review-gated claims. Update company inventory note and directory geography. Label vacancy-derived records as listed by, not confirmed whole-building management. Suppress ElPasoCounty statistics outside supported Texas cities.

## Risks

Public vacancies do not establish a complete portfolio or management of all building units. Espina photos explicitly depict a similar unit. Availability and terms change; no advertised rent or promotion copied. No branded community names invented. External photos can become unavailable and no reuse license is asserted. Excluded condos, duplexes and stale syndicated leads. No production mutations, texts, charges or outreach.

## Verify Steps

Passed type-check and diff-check. Passed38targeted tests plus rerun18corporate tests including a new shared-contact/NM-address regression (39distinct tests). Real text-claim handlers tested with mocked providers across101catalog records in both languages. All9photo URLs fetched/decoded and visually inspected. Six localized HTTP previews passed summaries, photos, website and claim links, unit-scope notes and correct county context. Both Haggerty portfolio previews show3entries. Browser confirmed Spanish photos loaded, official website destination, no ElPasoCounty context on NM page, and mobile390px has no horizontal overflow with48px claim button. Read-only reviewer finding about two management labels resolved.

## Rollback Plan

Revert this implementation before publishing. If deployed, restore the previous production revision citybeat-web-00471-lur through the standard release workflow. No live records were mutated.

## Notes

Research provenance and exclusions are in haggerty-research.json; input builder retains observed photo IDs. Lawson listing contact9159955616; Espina andPayne shared published leasing contact9157573445. Phone verification does not itself grant editing authority; admin review remains required. Official LasCruces office is5755237551 but listing phone is retained. Preview screenshot:haggerty-es-preview.png. Publication requires fresh approval for up to USD1 GoogleCloud build/deployment, no subscription.

