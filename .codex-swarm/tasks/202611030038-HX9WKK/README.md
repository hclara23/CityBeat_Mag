---
id: "202611030038-HX9WKK"
title: "Build reviewed bilingual property website and brochure importer"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "dd8f5498a7802412476b609f42e12b9c2a3fc323", message: "✨ HX9WKK start: implement reviewed bilingual property imports | details: add disabled-by-default bounded Firecrawl and offline Docling adapters plus optional gated bilingual AI drafting; add source and duplicate review with per-field compare-and-set and photo-rights confirmation; preserve corporate permissions billing gates and pending publication; verify 35 isolated tests real offline PDF conversion bilingual browser flow and production build" }
comments:
  - { author: "ORCHESTRATOR", body: "start: implement approved local bilingual property importer | details: providers remain disabled and no deployment or spending authorized" }
  - { author: "CODER", body: "start: implement reviewed bilingual property imports | details: add disabled-by-default bounded Firecrawl and offline Docling adapters plus optional gated bilingual AI drafting; add source and duplicate review with per-field compare-and-set and photo-rights confirmation; preserve corporate permissions billing gates and pending publication; verify 35 isolated tests real offline PDF conversion bilingual browser flow and production build" }
  - { author: "ORCHESTRATOR", body: "verified: complete local property import implementation with 35 passing tests, real offline PDF adapter and bilingual functional browser checks | details: TypeScript and isolated production build pass; no paid activation or deployment; operating cost assumptions and limitations documented" }
doc_version: 2
doc_updated_at: "2026-11-03T00:50:17+00:00"
doc_updated_by: "agentctl"
description: "Approved local-only Firecrawl and Docling integration: portfolio import UI, bounded source extraction, English and Spanish editable drafts, provenance and duplicate review, permissions and preservation of existing edits. No paid usage or deployment. CODER implementation then TESTER and REVIEWER validation then INTEGRATOR closure."
---
## Summary

Build locally tested property website and brochure imports into reviewed English and Spanish drafts. User approved implementation, with no spending or deployment.

## Scope

CODER implements Firecrawl adapter, Docling brochure integration and portfolio draft review; TESTER checks import and authorization behavior; REVIEWER audits protections; INTEGRATOR records local results and operating cost assumptions. No production mutations or paid calls.

## Risks

Untrusted websites and documents, conflicting or incomplete property facts, duplicate records, inaccurate translation, unintended provider spending. Providers disabled by default and drafts require human review.

## Verify Steps

Passed 35 importer and portfolio tests; TypeScript check; isolated Next production build (15 static pages, existing ApartmentGallery img warnings only); EN and ES functional Chrome prepare-review-submit flows with synthetic backend. Real offline Docling PDF conversion passed18.251s cold and actual Node adapter6.837s warmed cache with bilingual facts. Existing four Docling pilot tests also passed. Firecrawl and optional AI use mocks only; no paid calls or live database writes.

## Rollback Plan

Keep provider activation disabled and revert task implementation commit if local verification fails. No deployed resources or production data require rollback.

## Notes

Local-only feature: providers off and allowances zero. Approved corporate owners can import one page or text PDF/DOCX at a time. Unknown details need review; fact templates are not full source translation; optional AI remains disabled. Scanned PDFs, brochure image extraction, staff imports into unclaimed firms and hosted worker packaging are outside this local implementation. Costs and measured limits are in docs/property-import-costs.md. REVIEWER found no blocking issues after gallery and PDF parsing fixes.

