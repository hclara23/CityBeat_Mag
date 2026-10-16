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
doc_updated_at: "2026-10-16T22:52:03+00:00"
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

1. Run targeted unit tests for derived metrics, trust signals, short links, lead status, and entitlements. 2. Run web type-check and full tests. 3. Build the production web app. 4. Review owner, public listing, Premium sales, and homepage flows in English and Spanish at mobile and desktop widths. 5. Deploy a no-traffic candidate. 6. Run candidate security, payment, and route smoke tests. 7. Promote only after success and verify public English/Spanish routes and health endpoint.

## Rollback Plan

Before promotion, the candidate receives no production traffic. If candidate checks fail, do not promote. If live checks fail, the workflow automatically restores the prior Cloud Run revision. Application changes remain reversible through the scoped implementation commit; no billing data, subscriptions, or existing customer entitlements will be migrated or deleted.

## Notes

User approved the full seven-phase plan on 2026-10-16 and explicitly approved one Google Cloud Build execution estimated near .03 with a hard cap of  and no recurring commitment. Existing email frequency must remain unchanged; reminders should be in-product or folded into the existing monthly report. AI-labeled features must use deterministic templates unless a future separately approved budget is provided.

