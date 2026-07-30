---
id: "202607302022-SZ9ZCP"
title: "Create sales print materials and refresh user guide"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["docs", "frontend", "sales", "deployment"]
verify: ["npm run test", "npm run lint", "npm run type-check", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: audit the live sales catalog and current guides, create two concise print-ready sales references, update in-app procedures and download links, render every page, then test, commit, deploy, and verify production." }
  - { author: "ORCHESTRATOR", body: "Verified: generated and validated both PDFs against the canonical catalog; visually inspected all six rendered pages; passed 52 tests, lint with zero warnings, TypeScript checks, the 104-page production build, and source-only diff whitespace checks." }
doc_version: 2
doc_updated_at: "2026-07-30T20:33:00+00:00"
doc_updated_by: "agentctl"
description: "Create short, direct, print-ready sales materials covering every current product, price, deliverable, customer value, and accurate backlink/SEO benefit; add a click-by-click Sales Desk quick-start based on the deployed interface; update the in-app user guide and download links for all current procedures and features; visually verify, commit, deploy, and smoke-test production."
---
## Summary

Deliver two short, print-ready sales PDFs; expose both from the unified Sales Desk; and refresh the role-aware and repository user guides to match the current sales, payment, fulfillment, referral, jobs, review, and finance workflows.

## Context

The previous sales guide was too long and the written procedures lagged behind the unified Sales Desk. Salespeople need an accurate product/price/value reference plus a click-by-click checkout handoff sheet. Users and staff also need one current guide for the product-specific post-payment wizard, recurring cards, referral credits, job board, article review, and developer controls.

## Scope

Generate a four-page Sales Guide and two-page New Sale Quick Start from canonical product data; publish matching PDFs under the web downloads directory; add Sales Guide and Quick Start controls to the Sales Desk; update RoleGuide and docs/USER_GUIDE.md with exact current prices and procedures; validate PDF contents, links, hashes, and visual rendering; run application tests, lint, type checking, and production build; deploy and smoke-test production.

## Risks

Prices and availability can change, so generation verifies the canonical TypeScript catalog and the materials direct staff to trust the live checkout. SEO language must not guarantee rankings; the guide explains that accurate citations and relevant links support discovery, and that paid links require proper qualification. Payment instructions must keep all card entry inside Stripe. Stale downloadable files are prevented by publishing byte-identical copies and verifying hashes.

## Verify Steps

Run the PDF generator with --verify using the bundled Python runtime. Render every page at 144 DPI and inspect for clipping, overflow, or illegible text. Run npm run test, npm run lint, npm run type-check, and npm run build. Run git diff --check. After deployment, confirm service health, both application/pdf downloads, page counts, and the localized guide and Sales Desk routes.

## Rollback Plan

Revert the task commit and redeploy the previous Cloud Run revision. The change adds static PDF downloads and documentation/UI links only; it does not migrate data or alter payment records. Previous PDFs remain recoverable from Git history.

## Notes

PDF design uses a white, high-contrast US Letter layout for office printing. Canonical download names are citybeat-sales-guide.pdf and citybeat-sales-desk-quick-start.pdf. Official Google guidance is linked for local prominence context; salespeople are explicitly told not to promise ranking outcomes.

