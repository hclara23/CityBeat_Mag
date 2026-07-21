---
id: "202607212123-1CBZQV"
title: "Harden sales handoff and refund lifecycle"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202607212040-7XJF9K", "202607212040-HTN28A"]
tags: ["sales", "security"]
verify: ["npm test", "npm run type-check -- --filter=@citybeat/web"]
comments:
  - { author: "PLANNER", body: "Created from the final security review; all listed medium-severity findings must be resolved before FQXEFT can close." }
doc_version: 2
doc_updated_at: "2026-07-21T21:23:43+00:00"
doc_updated_by: "agentctl"
description: "Resolve final review findings by binding payment-link delivery to the signed-in rep's canonical order, deferring new directory listing creation until paid intake is complete, marking exact refunded orders for staff attention, freezing handoff data, rejecting invalid products, and tightening intake validation."
---
## Summary

Close the final security-review gaps in the unified sales and post-payment workflow.

## Context

The final review found that link delivery was domain-checked but not order-bound, new directory listings were created before the paid intake boundary, and refund status handling was incomplete for subscription orders.

## Scope

Bind send-link delivery and recipient data to the rep-owned sales order; freeze the generated handoff; defer new directory listing creation until paid intake submission; preserve directory subscription metadata during fulfillment; resolve one-time and subscription refunds to the exact order and mark staff attention; reject invalid product ids, fail closed on Founding lookup errors, and validate structured intake values.

## Risks

Webhook or fulfillment regressions could duplicate commissions, lose subscription attribution, create incomplete listings, or leave refunded work active.

## Verify Steps

Run the focused sales tests, full npm test suite, web TypeScript check, lint, and inspect the final diff against each recorded review finding.

## Rollback Plan

Revert the corrective commit while keeping FQXEFT and the parent task open.

## Notes

No finding is considered closed until a regression test or direct route-level check covers the corrected trust boundary.

