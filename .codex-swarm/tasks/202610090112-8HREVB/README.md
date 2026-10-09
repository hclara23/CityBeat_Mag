---
id: "202610090112-8HREVB"
title: "Extend published app legal audit"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610082359-WKDD0X"]
tags: ["legal", "compliance"]
commit: { hash: "d5a16cd120d489090914ed115e1da8b1e697ddfa", message: "📝 8HREVB plan expanded legal audit for CityBeat, Elevate, and Builders" }
comments:
  - { author: "ORCHESTRATOR", body: "Approved by user. CityBeat .co is canonical; Elevate and Builders legal updates are in scope; deployment is excluded." }
  - { author: "ORCHESTRATOR", body: "verified: CityBeat uses the live .co domain | details: Elevate tests and typecheck passed; Builders tests and production compile passed; legal changes are committed locally and were not deployed." }
doc_version: 2
doc_updated_at: "2026-10-09T01:16:34+00:00"
doc_updated_by: "agentctl"
description: "Verify CityBeat uses citybeatmag.co, audit Elevate El Paso and Builders of the Desert against their actual production data flows, update legal documents and incorrect CityBeat links, validate and commit all local changes, and do not deploy."
---
## Summary

Extend the completed published-app legal audit to Elevate El Paso and Builders of the Desert, while verifying that CityBeat uses its actual citybeatmag.co domain.

## Context

Public verification on October 8, 2026 confirmed citybeatmag.co and elevateelpaso.com are live. Builders of the Desert is live at buildersofthedesert.org; buildersofthedesert.com and the misspelled buildersofthedersert.com did not resolve. Elevate contained the only active citybeatmag.com reference.

## Scope

Audit existing privacy and terms disclosures against implemented data flows; add or revise legal pages as needed; correct Elevate's stale CityBeat portfolio link; validate and commit local changes. No deployment, purchases, or production mutation.

## Risks

Legal text must describe observed behavior without promising unsupported retention periods, regulatory status, or rights. Both target repositories contain unrelated user changes that must be preserved.

## Verify Steps

Elevate: pnpm exec prettier --check passed; @elevate/content 27 tests passed; @elevate/web typecheck passed; repository search found no remaining citybeatmag.com references outside excluded generated/dependency directories. Builders: 22 Vitest files and 51 tests passed; Next.js production compile completed successfully; git diff --check passed for both legal pages.

## Rollback Plan

Revert only the dedicated legal-audit commits in the affected repositories. No production rollback is required because deployment is outside scope.

## Notes

CityBeat required no code change because its application and legal documents already use citybeatmag.co. Elevate commit 6658931 updates bilingual privacy and terms disclosures plus the CityBeat portfolio URL. Builders commit 3a12557 expands privacy and tour terms for Firebase, PayPal, analytics, public uploads, retention, safety, third parties, and Texas venue. No deployment or purchase was performed.

