---
id: "202607212040-HTN28A"
title: "Refresh sales workflow documentation and guide"
status: "TODO"
priority: "high"
owner: "DOCS"
depends_on: ["202607212040-G73WWE"]
tags: ["docs", "sales"]
verify: ["python scripts/generate-sales-guide.py"]
doc_version: 2
doc_updated_at: "2026-07-21T20:41:00+00:00"
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

Use the existing CityBeat visual language and stable download URL.

