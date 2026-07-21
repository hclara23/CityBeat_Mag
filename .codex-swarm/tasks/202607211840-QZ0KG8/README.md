---
id: "202607211840-QZ0KG8"
title: "Create downloadable sales guide"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["docs", "frontend", "sales"]
verify: ["npm run type-check --workspace @citybeat/web"]
commit: { hash: "b9da5ec3bd397e526d0d8e50f91850551a13a837", message: "📝 QZ0KG8 publish branded sales playbook and dashboard download access" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: author the evidence-based sales playbook, publish both PDF copies, add dashboard access, and complete visual and code verification." }
  - { author: "ORCHESTRATOR", body: "verified: generated and visually reviewed the 12-page sales guide | details: PDF structure, text, links, duplicate hash, Python compilation, and web type-check all passed." }
doc_version: 2
doc_updated_at: "2026-07-21T18:53:41+00:00"
doc_updated_by: "agentctl"
description: "Create and publish a branded internal CityBeat sales guide covering the current product catalog, promotions, sales angles, and safe Stripe payment-link/QR procedures, with a download link on the sales dashboard."
---
## Summary

Create a downloadable, branded CityBeat sales playbook based on the product catalog and payment workflows currently implemented in the application.

## Context

Sales representatives need one internal reference for rates, promotions, customer value, qualification, objections, and safely closing in-person or phone sales through Stripe Checkout.

## Scope

Author a ReportLab PDF generator; generate and publish the PDF under output/pdf and apps/web/public/downloads; add a download link to the sales dashboard; cover directory plans, advertising products, job and event add-ons, Founding 100 terms, sales angles, follow-up, commissions, and payment-link/QR procedures.

## Risks

Prices or promotions can change after publication; the guide must date its rate card and tell reps to confirm the live sales wizard. SMS depends on Twilio configuration. Customers must enter their own card details in Stripe Checkout.

## Verify Steps

Run the PDF generator with the bundled Python runtime. Validate page count, extracted text, hyperlinks, and duplicate output hashes. Render every page with Poppler and inspect for clipping or overlap. Run npm run type-check --workspace @citybeat/web and git diff --check.

## Rollback Plan

Remove the dashboard download link and generated PDF copies, then revert the generator and task artifacts through the associated commits.

## Notes

Implemented a branded 12-page internal sales playbook and published identical copies under output/pdf and apps/web/public/downloads. Added the sales-dashboard download link. Verified 13 clickable PDF links, required text, matching SHA-256 hashes, letter-page metadata, Python compilation, web TypeScript, and git diff whitespace. Rendered all pages at 120 DPI and visually inspected every page; the final content explicitly separates rep-wizard advertising checkout from dedicated job/event auto-publishing flows.

