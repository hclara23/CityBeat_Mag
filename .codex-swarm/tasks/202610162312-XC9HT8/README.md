---
id: "202610162312-XC9HT8"
title: "Repair analytics and add Premium conversion pixel"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["analytics", "premium", "privacy", "frontend", "backend", "deployment"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm test", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: user approved the analytics repair, privacy-preserving Premium conversion pixel, guarded deployment, and a one-time Google Cloud Build charge capped at $1." }
doc_version: 2
doc_updated_at: "2026-10-16T23:13:14+00:00"
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

User approved the full plan and a one-time Google Cloud Build charge up to $1. The screenshot identified GA4 property G-C6PLK304L6. Initial source audit found production was compiled with a different default ID, G-D8V1XC2346, explaining why the shown GA4 property received zero data. Existing first-party per-listing analytics already aggregate CityBeat listing views and actions without visitor identity; the new pixel will extend that model to business-owned websites.

