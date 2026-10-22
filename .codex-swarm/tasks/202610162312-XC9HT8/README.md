---
id: "202610162312-XC9HT8"
title: "Repair analytics and add Premium conversion pixel"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["analytics", "premium", "privacy", "frontend", "backend", "deployment"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm test", "npm run build --workspace=@citybeat/web"]
commit: { hash: "0649063c9d06d652a1185f4f44af486e2a4d6dae", message: "✨ 202610162312-XC9HT8 repair analytics and add Premium conversion pixel" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: user approved the analytics repair, privacy-preserving Premium conversion pixel, guarded deployment, and a one-time Google Cloud Build charge capped at $1." }
  - { author: "ORCHESTRATOR", body: "Verified: 661 automated tests, web type-check, optimized production build, guarded candidate smoke tests, 100 percent promotion, correct live GA4 and Cloudflare tags, Premium pixel availability, access controls, and payment health all passed." }
  - { author: "ORCHESTRATOR", body: "verified: analytics repair and Premium pixel are deployed on revision citybeat-web-00328-hil | details: local and production checks passed, and no recurring vendor expense was added." }
doc_version: 2
doc_updated_at: "2026-10-16T23:31:25+00:00"
doc_updated_by: "agentctl"
description: "Audit and repair production Google Analytics 4 and Cloudflare Web Analytics, add first-party listing interaction events, implement a privacy-preserving domain-restricted Premium business conversion pixel with owner diagnostics and reporting, document privacy behavior, test it, and deploy through the guarded Cloud Run pipeline. Add no recurring vendor expense and keep the explicitly approved one-time Google Cloud Build charge within $1."
---
## Summary

Repair CityBeat analytics so the correct GA4 property receives traffic, verify Cloudflare coverage, strengthen first-party listing events, and add a zero-subscription-cost Premium conversion pixel with owner setup, diagnostics, privacy controls, and reporting.

## Scope

Use GA4 measurement ID G-C6PLK304L6; preserve first-party pageview analytics; add Cloudflare and GA diagnostics; emit meaningful listing actions to GA4; create a Premium/Featured-only pixel configuration and event ingestion API with public script, domain allowlist, rotating key, rate limits, bot filtering, aggregate-only storage, setup UI, connection test, and owner analytics. Update privacy/cookie disclosures. Deploy one guarded Cloud Run candidate within the approved one-time $1 build cap.

## Risks

Risks include measuring the wrong GA property, double-counted pageviews, forged or cross-domain pixel events, PII collection, unbounded Firestore writes, entitlement bypass, CSP failures, and analytics code affecting page reliability. Mitigate with one canonical GA ID, explicit SPA pageviews, aggregate-only events, strict event and domain validation, hashed public keys, no cookies or persistent visitor identifiers, rate limits, bot rejection, server-side entitlement and ownership checks, fail-open client tracking, tests, candidate smoke checks, and automatic rollback.

## Verify Steps

Run targeted unit tests, the web type-check, full test suite, and production build. Confirm generated HTML references G-C6PLK304L6 and loads the Google tag. Verify public pixel script behavior, authorized configuration endpoints, domain enforcement, aggregate counters, CSP compatibility, Cloudflare response headers/beacon state, bilingual owner UI, candidate route/security/payment smoke checks, and live production endpoints after promotion.

## Rollback Plan

Deploy without traffic and promote only after candidate checks. The workflow automatically restores the previous Cloud Run revision if live verification fails. Code changes are reversible through the scoped implementation commit. Pixel configuration is additive; disabling or rotating it invalidates future ingestion without deleting listings, subscriptions, or existing analytics.

## Notes

Implemented in local commit 0649063 and deployed as remote commit 023af59. GitHub Actions run 38981044496 succeeded through no-traffic candidate deployment, smoke tests, promotion, and public-domain verification. Cloud Run revision citybeat-web-00328-hil serves 100 percent of traffic. Live HTML contains GA4 measurement ID G-C6PLK304L6 and the Cloudflare Web Analytics beacon; the old GA ID is absent. The public conversion pixel loader returns JavaScript with cross-origin access, owner and admin APIs return 401 anonymously, and /api/health/payments returns 200. Cloudflare Web Analytics was configured in manual-snippet mode at no recurring vendor charge. Analytics dashboards may need normal ingestion time before showing visits.

