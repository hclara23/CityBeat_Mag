---
id: "202607212040-HTN28A"
title: "Refresh sales workflow documentation and guide"
status: "DONE"
priority: "high"
owner: "DOCS"
depends_on: ["202607212040-G73WWE"]
tags: ["docs", "sales"]
verify: ["C:/Users/hclar/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe scripts/generate-sales-guide.py --verify"]
commit: { hash: "1a53848436b3ef699632c9ff315a45f042be4ca2", message: "📚 HTN28A refresh sales workflow docs and downloadable playbook" }
comments:
  - { author: "DOCS", body: "Start: update staff instructions for the unified Sales Desk and customer brief, regenerate both PDF copies, and visually inspect every rendered page." }
  - { author: "DOCS", body: "verified: unified Sales Desk documentation, 13-page downloadable playbook, stable public copy, all-page render inspection, and web TypeScript check." }
doc_version: 2
doc_updated_at: "2026-07-21T21:16:45+00:00"
doc_updated_by: "agentctl"
description: "Update staff guidance and regenerate the downloadable sales PDF to document the unified Sales Desk, recurring billing, payment links and QR codes, customer intake, and fulfillment handoff."
---
## Summary

Update staff instructions and the downloadable sales guide for the new end-to-end workflow.

## Context

The current guide documents separate public forms and an older salesperson wizard.

## Scope

Document product selection, recurring billing, payment links, QR codes, the customer intake experience, order statuses, follow-up, and troubleshooting; regenerate both published and output PDFs.

## Risks

Documentation drifting from implemented field requirements or introducing clipped PDF content.

## Verify Steps

Run the guide generator, inspect PDF metadata and extracted text, render all pages with Poppler, and visually review every page.

## Rollback Plan

Restore the previous guide source and both generated PDF copies.

## Notes

Updated the in-app staff guide and USER_GUIDE for the unified Sales Desk, recurring versus one-time billing, Stripe links and QR codes, private customer intake, fulfillment statuses, and commission attribution. Regenerated both PDF copies as version 2.0. Verification: 13 pages, 13 links, 48,514 bytes; all 13 Poppler-rendered pages visually inspected with no clipping, overflow, or broken glyphs. Web TypeScript check passed.

