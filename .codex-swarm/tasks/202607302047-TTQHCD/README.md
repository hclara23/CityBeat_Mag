---
id: "202607302047-TTQHCD"
title: "Add selectable free and paid new-directory listings"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "backend", "sales", "directory", "stripe", "deployment"]
verify: ["npm run test", "npm run lint", "npm run type-check", "npm run build"]
commit: { hash: "627fc65c05d7e8782770734c4d47ac9a7a84805f", message: "✨ TTQHCD add selectable directory pricing and claim handoffs" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: audit the new-business checkout path, add explicit free and paid listing choices, create separate listing and payment handoffs, then verify and deploy the corrected sales flow." }
  - { author: "ORCHESTRATOR", body: "Verified locally: 53 tests passed; lint completed with zero warnings; TypeScript type-check passed; Next.js production build compiled and generated 104 routes; regenerated sales guide and quick-start PDFs passed text/link checks and all six rendered pages were visually inspected without clipping or overlap. Claim verification preserves confirmed paid tiers, Sales Desk listings cannot open a duplicate checkout, and the public listing API redacts customer payment/internal sales fields." }
  - { author: "ORCHESTRATOR", body: "Verified: all 53 automated tests, lint, TypeScript type-check, and the 104-route production build pass; both PDFs pass content/link checks and visual inspection; free and paid listing handoffs plus duplicate-charge claim protections are ready to deploy." }
  - { author: "ORCHESTRATOR", body: "verified: deployed revision citybeat-web-00156-dkf to 100% traffic | details: homepage, health, guide, exact PDF hashes, protected Sales Desk redirect, and listing-link authentication boundary all pass production smoke checks." }
doc_version: 2
doc_updated_at: "2026-07-30T21:28:52+00:00"
doc_updated_by: "agentctl"
description: "Correct the unified Sales Desk so new businesses explicitly choose Basic Free, Founders $9.99 monthly, or Premium $19.99 monthly; free listings bypass Stripe and return only a claimable public listing handoff, while paid listings return both their order-bound payment handoff and the created listing handoff; provide Open, QR, Email, Text, and Copy actions, prevent stale or duplicate payment handoffs, update tests and sales guidance, deploy, and smoke-test production."
---
## Summary

Make new directory creation an explicit three-choice flow: Basic Free, Founders $9.99 monthly, or Premium $19.99 monthly. Free listings bypass Stripe and return only a public claim handoff; paid new listings return both the Stripe payment handoff and the public listing handoff.

## Context

The Sales Desk initialized every new directory sale as Premium Monthly, which could produce a $19.99 checkout without an explicit price choice. Newly created businesses also lacked an immediate public listing URL and claim QR, so salespeople could not hand the customer their actual listing independently of payment.

## Scope

Add Basic Free to the canonical catalog; limit new-business choices to Free, Founders Monthly, and Premium Monthly; create public Basic directory records before or without checkout; preserve claimability after paid webhooks and fulfillment; add listing Open, QR, Email, Text, and Copy handoff with seller and destination validation; show payment handoff only for paid products; label free records accurately in Recent Orders; prevent private directory billing and seller fields from reaching public client props; update in-app, Markdown, and printable sales guidance; test, deploy, and smoke-test production.

## Risks

Free creation must never initialize Stripe or produce a payment URL. Listing handoffs must be restricted to records created by the signed-in seller and to the recorded customer destination. Paid rep-created listings must remain unclaimed until the real owner verifies the on-record business email; payment alone cannot prove ownership. Fulfillment must merge paid details without hiding or resetting a claimed public page. Existing listing upgrades keep the wider paid-plan catalog.

## Verify Steps

Run npm run test, npm run lint, npm run type-check, and npm run build. Generate both PDFs with the bundled Python runtime, confirm page counts, link counts, extracted text, and public copies, render all six pages at 144 DPI, and inspect for clipping or misleading free/payment language. Run source-only git diff --check. After deployment, verify health, guide and PDF routes, the protected Sales Desk redirect, and the new send-listing endpoint authentication boundary.

## Rollback Plan

Revert the implementation commit and redeploy the prior Cloud Run revision. The change introduces no schema migration: added listing and audit fields are additive, and existing paid orders remain readable. If necessary, disable the Basic Free catalog option while retaining existing public listings.

## Notes

The Sales Desk uses the existing CityBeat industrial/editorial design. Cyan identifies Stripe payment; magenta identifies the public listing claim handoff. Basic Free is the default for a blank new-business flow. Paid new businesses receive two clearly labeled cards, while free listings never render payment actions. Claiming a Sales Desk listing verifies ownership without creating another checkout; a confirmed paid pending tier survives verification, and the payment webhook preserves an owner who claimed before paying. Implementation commit 627fc65c05d7 deployed as Cloud Run revision citybeat-web-00156-dkf at 100% traffic. Production smoke checks passed for homepage, health, guide, PDF content types and exact hashes, the protected Sales Desk redirect, and the 401 authentication boundary on the new listing-link sender.

