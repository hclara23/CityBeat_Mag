---
id: "202607211840-QZ0KG8"
title: "Create downloadable sales guide"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["docs", "frontend", "sales"]
verify: ["npm run type-check --workspace @citybeat/web"]
doc_version: 2
doc_updated_at: "2026-07-21T18:41:01+00:00"
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

Approved deliverables: an English internal sales guide, a public-download copy, a stable output/pdf copy, and a sales-dashboard download link. The guide will distinguish published rates from negotiated custom charges and call out that Founding Annual is not currently selectable in the rep wizard.

