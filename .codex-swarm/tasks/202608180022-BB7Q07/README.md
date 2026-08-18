---
id: "202608180022-BB7Q07"
title: "Link CityBeat catalog to Elevate Sales Desk"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["sales", "frontend", "backend", "training"]
verify: ["npm run type-check", "npm test", "npm run build"]
commit: { hash: "8e9d9e34b413738344b4ceecd67718aac0ac835a", message: "🔐 202608180022-BB7Q07 deliver partner secret to Cloud Run" }
comments:
  - { author: "ORCHESTRATOR", body: "Approved plan: connect all CityBeat products to Elevate's personalized Sales Desk and teach representatives how to position and close CityBeat offers." }
  - { author: "ORCHESTRATOR", body: "Start: audit the canonical catalog, finish the signed partner checkout contract, then implement Elevate UI, training, tests, documentation, and deployment verification." }
  - { author: "ORCHESTRATOR", body: "Verified: CityBeat CI and Cloud Run deployment succeeded; the signed production catalog returns all 12 products. Elevate PR 15 passed audit, type, unit, integration, build, E2E, and accessibility gates, merged as 17d2323, deployed healthy, and passed the full public smoke suite with zero failures." }
doc_version: 2
doc_updated_at: "2026-08-18T00:39:28+00:00"
doc_updated_by: "agentctl"
description: "Expose CityBeat's authoritative sellable catalog to Elevate sales agents through a signed partner API, support checkout links and QR handoff including manager-approved custom pricing, add CityBeat-specific sales training, tests, documentation, production configuration, deployment, and live smoke verification."
---
## Summary

Expose CityBeat's complete canonical catalog to Elevate through a signed server-to-server partner endpoint, including paid checkout and free listing handoff.

## Scope

CityBeat partner product projection, HMAC request verification, checkout and listing handoff, shared founding availability helper, contract tests, environment documentation, and operator runbook. Elevate consumer, Sales Desk UI, and training are committed in the Elevate repository.

## Risks

A mismatched partner secret disables the integration. Directory products require a category. Fixed prices cannot be discounted or multiplied. Partners cannot bypass ownership verification, merge listings, or receive CityBeat payout attribution.

## Verify Steps

Run npm run type-check, npm test, and npm run build. In production, confirm 12 products, free Basic listing handoff, one paid checkout, directory category enforcement, and signed-request rejection.

## Rollback Plan

Remove CITYBEAT_API_URL or CITYBEAT_PARTNER_SECRET from Elevate to disable partner sales without affecting CityBeat's first-party Sales Desk. Revert the CityBeat integration commit if the endpoint itself must be removed.

## Notes

All 12 canonical products are projected dynamically. Basic Free returns checkoutRequired false and a listing handoff URL; paid products return CityBeat-hosted Stripe Checkout.

