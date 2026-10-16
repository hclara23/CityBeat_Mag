---
id: "202610162251-DZJBW5"
title: "Build and deploy CityBeat Premium Value System"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "premium", "conversion", "retention", "deployment"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm test", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: approved seven-phase implementation and one-time Google Cloud Build charge capped at ; no new recurring paid services." }
doc_version: 2
doc_updated_at: "2026-10-16T23:05:26+00:00"
doc_updated_by: "agentctl"
description: "Implement the approved owner ROI dashboard, onboarding and listing health, factual trust signals, marketing toolkit, proof-led Premium conversion surfaces, retention features, bilingual QA, and guarded production release. Reuse existing first-party data and services, add no new vendor subscription or AI API usage, preserve existing email frequency, and keep the one-time Google Cloud Build charge within the explicitly approved  cap."
---
## Summary

Build and deploy the approved CityBeat Premium Value System: unified owner ROI and lead workflow, guided listing quality, factual public trust signals, a reusable marketing toolkit, proof-led Premium conversion surfaces, retention tools, bilingual QA, and a guarded Cloud Run release.

## Scope

Implement the seven approved phases using existing first-party listing, analytics, lead, review, offer, report, QR, and billing data. Add English and Spanish UI; keep Featured guarantees distinct from Premium; use deterministic templates instead of AI APIs; preserve the existing report email schedule; add no vendor subscription. Deploy once through the existing no-traffic candidate pipeline within the explicitly approved  Google Cloud Build cap.

## Risks

This is a broad customer-facing release touching authenticated owner workflows, public listing trust, analytics presentation, and conversion pages. Risks include authorization regressions, misleading badges, inflated ROI claims, cross-tier entitlement leakage, mobile overflow, localization drift, and increased email or compute usage. Mitigate with derived-only factual signals, server-side ownership checks, no ranking or traffic guarantees, unchanged email cadence, static templates, targeted tests, candidate smoke tests, and automatic rollback.

## Verify Steps

Passed npm run type-check --workspace=@citybeat/web. Passed npm test: 657 tests total (637 web and 20 shared-library tests). Passed npm run build --workspace=@citybeat/web. Reviewed the bilingual Premium page and mobile/desktop layout locally. GitHub Actions run 38978782893 deployed scoped production commit 96b0d9a34bfe9012bf6c02a051e07a9c052a3ab1 as Cloud Run revision citybeat-web-00326-gik. Candidate route, authorization, checkout guard, webhook signature, and payment-health smoke tests passed before promotion. Revision was promoted to 100 percent traffic. Independent checks returned HTTP 200 and expected release copy for /en/premium, /es/premium, /en, /en/directory, and /api/health.

## Rollback Plan

Before promotion, the candidate receives no production traffic. If candidate checks fail, do not promote. If live checks fail, the workflow automatically restores the prior Cloud Run revision. Application changes remain reversible through the scoped implementation commit; no billing data, subscriptions, or existing customer entitlements will be migrated or deleted.

## Notes

Implemented owner ROI metrics, lead pipeline statuses, listing completeness guidance, derived factual trust signals, QR and social marketing tools, offer expiration and duplication controls, monthly report enhancements, a bilingual proof-led Premium comparison page, homepage conversion placement, and sitemap discovery. The release adds no new vendor subscription, AI API usage, or email cadence. Premium claims remain factual and do not promise ranking, placement, traffic, or leads. User approved the one-time Google Cloud Build execution up to $1; deployment completed successfully in 6 minutes 52 seconds. Local implementation commit: 0b11e69. Scoped production commit: 96b0d9a34bfe9012bf6c02a051e07a9c052a3ab1. GitHub Actions run: 38978782893.

