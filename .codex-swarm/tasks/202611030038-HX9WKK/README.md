---
id: "202611030038-HX9WKK"
title: "Build reviewed bilingual property website and brochure importer"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: implement approved local bilingual property importer | details: providers remain disabled and no deployment or spending authorized" }
doc_version: 2
doc_updated_at: "2026-11-03T00:39:13+00:00"
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

Run focused importer tests and existing portfolio regression tests, TypeScript validation and isolated production build where practical. Use only synthetic local fixtures; no live paid APIs.

## Rollback Plan

Keep provider activation disabled and revert task implementation commit if local verification fails. No deployed resources or production data require rollback.

