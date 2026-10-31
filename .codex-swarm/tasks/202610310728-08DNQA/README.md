---
id: "202610310728-08DNQA"
title: "Enforce hyperlocal import quality and pilot local Docling drafts"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "b4cd3cfa8d530bd1e0e86352a03c296d9acab16a", message: "✨ 08DNQA start: save the isolated Docling pilot, exact-field English and Spanish conversion checks, local-only safeguards and reproducible operating instructions." }
comments:
  - { author: "ORCHESTRATOR", body: "Start: enforce reviewed eleven-city imports and run an isolated local Docling pilot without production writes or new recurring costs." }
  - { author: "ORCHESTRATOR", body: "start: enforce eleven-city import review, preserve source and verification evidence, protect paid owners and branches, and add tested offline Docling drafts with local emulator integration coverage." }
  - { author: "ORCHESTRATOR", body: "start: save the isolated Docling pilot, exact-field English and Spanish conversion checks, local-only safeguards and reproducible operating instructions." }
  - { author: "ORCHESTRATOR", body: "verified: local eleven-city data-quality improvements and offline Docling pilot completed in 926048b and b4cd3cf | details: 1014 regression tests, four real-document pilot tests, isolated build, Firestore emulator import checks and EN/ES browser checks passed. No production writes, deployment, recurring service or subagents." }
doc_version: 2
doc_updated_at: "2026-10-31T07:46:08+00:00"
doc_updated_by: "agentctl"
description: "Approved eleven-city boundary, conservative duplicate review, source and verification metadata, local Docling pilot producing review-only listing drafts. No new monthly costs, no subagents, no deployment until local checks complete."
---
## Summary

Enforce an eleven-city review boundary for OSM and ScrapeFlow imports, preserve provenance and owner data, and pilot offline Docling drafts.

## Context

User approved local data-quality improvements and a Docling pilot constrained to eleven named cities, no recurring cost and no subagents. OSM previously guessed El Paso/TX and both import paths published automatically; ScrapeFlow accepted West Texas and Juarez and automatically consolidated branches.

## Scope

Local code, tests and synthetic DOCX/HTML pilot only. Shared city policy, held imports, explicit staff approval with audit evidence, conservative duplicate handling. No subagents, production writes, network document conversion or new monthly services.

## Risks

Postal locality evidence is not a legal municipal boundary; staff approval remains mandatory. Existing live records are not rewritten. Race-safe create operations can reject a batch if another importer inserts the same source ID concurrently; rerun skips existing records. Docling pilot only covers labelled synthetic DOCX and HTML, not arbitrary brochures or OCR.

## Verify Steps

Run npm test, npx tsc --noEmit --incremental false -p apps/web/tsconfig.json, and an isolated production build with CITYBEAT_BUILD_DIR=.tmp/quality-next. Run .tmp/docling-pilot-venv/Scripts/python.exe -m unittest discover -s scripts/docling-pilot -v. Inspect generated synthetic drafts in .tmp/docling-pilot-results. No live ingestion or staff mutation calls.

## Rollback Plan

Before any deployment, revert the task implementation commit through the normal workflow. No production data was modified by this task. If later deployed, roll back the application revision; retained hidden import holds must not be bulk-cleared. The Docling pilot is local and removable independently.

## Notes

Local regression: 1,014 JS/TS tests passed (951 web, 53 shared-library, 10 scripts); four Python pilot tests passed with actual offline DOCX and HTML conversion, all seven fields matched in both samples. TypeScript and isolated production build passed. Real OSM and ScrapeFlow execution against a local Firestore emulator passed geographic rejection, held drafts, replay safety, paid-owner preservation and branch separation. EN/ES browser checks use synthetic emulator data. Initial non-emulator local preview failed Firestore permission checks; no production permissions were changed. Staff approval validation is covered by local unit tests, not a live authenticated staff mutation. No production writes or deployment.

