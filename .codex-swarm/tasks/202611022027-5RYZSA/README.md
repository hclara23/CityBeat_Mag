---
id: "202611022027-5RYZSA"
title: "Enrich RPM and M7 apartment listings and website links"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "f688649a93a17653bf90ae39aa8ac955d6ff32e8", message: "🚧 5RYZSA start: include researched apartment data, gallery and Census components | details: add safe website URL normalization and manager-override regression tests" }
comments:
  - { author: "ORCHESTRATOR", body: "start: enrich29local RPM and M7 entries with bilingual sourced content and69photo references | details: add website buttons and safe destinations across listing tiers; preserve manager edits and claim contacts; verify58localized pages and mocked claim flows" }
  - { author: "ORCHESTRATOR", body: "start: include researched apartment data, gallery and Census components | details: add safe website URL normalization and manager-override regression tests" }
  - { author: "ORCHESTRATOR", body: "verified: published enriched bilingual RPM and M7 listings and website buttons | details: 58 live apartment pages, basic and premium external links, images and health checks passed" }
doc_version: 2
doc_updated_at: "2026-11-02T21:38:27+00:00"
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

Lee Place and Amigos del Sol lack verified photos; Lee Place website is Coming Soon. M7 combined groups retained pending distinct address verification; Gardens constituent names shown. Source phone/address differences documented without changing claim routing. Photos remain remotely hosted with source credits; availability and reuse rights are not guaranteed. Census data is explicitly county-level, not resident or ZIP demographics. Approved deployment completed.

## Verify Steps

PASS local type check, diff check,22 apartment/catalog/claim/outbound tests plus7 enrichment/outbound tests (4 overlap), mocked SMS only. All69source images retrieved and visually inspected. All58English/Spanish detail routes passed locally and live. Live website CTAs passed for basic and premium business listings in both languages; browser confirmed correct external destinations and retained referral parameters. Browser confirmed ALZA image and4Cimarron images loaded; Spanish mobile local check390px had375px content width. CI audit, tests, candidate and live checks passed. Health and payment health HTTP200. Manager gallery overrides and removals tested. Live proof image: alza-enriched-live.png.

## Rollback Plan

Previous production revision citybeat-web-00467-zuj. Restore it using the normal traffic rollback workflow if needed. No live records or claims were mutated by this task.

## Notes

Published approved commit f688649 through successful GitHub run41528325160: https://github.com/hclara23/CityBeat_Mag/actions/runs/41528325160 . Cloud Build6dda8746-8c36-420c-9a1c-ab11f0577547 succeeded,2026-11-02T21:28:55Z to21:36:08Z. Cloud Run citybeat-web-00469-fir serves100percent traffic. User approved up to1USD; one build ran, actual billing not finalized. Research provenance remains in rpm-research.json, m7-research.json, m7-locator-observed.json and image-checks.json. No live claims, texts, outreach or card charges.

