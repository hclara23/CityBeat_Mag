---
id: "202607212040-94DM4B"
title: "Create unified salesperson Sales Desk"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202607212040-KXMN5S"]
tags: ["frontend", "code", "sales"]
verify: ["npm run type-check"]
commit: { hash: "e073922468137ac65e1688df98de9d2ae2840f61", message: "🎨 94DM4B merge pipeline and checkout into one adaptive Sales Desk" }
comments:
  - { author: "CODER", body: "Start: merge pipeline and checkout creation into one adaptive Sales Desk with the complete catalog and zero intermediate wizard clicks." }
  - { author: "CODER", body: "verified: the full workspace type-check passes and 33 regression tests remain green | details: the Sales Desk now exposes all 11 products, preserves lead prefills, and creates QR, email, SMS, or copied checkout handoffs without an intermediate step." }
doc_version: 2
doc_updated_at: "2026-07-21T20:40:57+00:00"
doc_updated_by: "agentctl"
description: "Combine the rep pipeline and new-sale experience into one adaptive dashboard with the complete grouped product catalog, minimal customer inputs, and one-click payment-link and QR handoff."
---
## Summary

Replace separate salesperson pipeline and new-sale screens with one adaptive Sales Desk.

## Context

Salespeople currently switch between two dashboards and only see a subset of the available CityBeat products.

## Scope

Combine pipeline metrics and quick sale creation, expose the complete grouped catalog, reduce repeated fields, and generate payment links plus local QR codes with accessible responsive UI.

## Risks

Role authorization regressions, route compatibility, and excessive UI complexity.

## Verify Steps

Run npm run type-check and manually verify keyboard, narrow-screen, product-switching, link, and QR interactions.

## Rollback Plan

Restore the previous /admin/sales/me and /admin/sales/new page implementations.

## Notes

The developer-only automated outreach screen remains separate.

