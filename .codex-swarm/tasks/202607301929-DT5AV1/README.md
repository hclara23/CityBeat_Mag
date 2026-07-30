---
id: "202607301929-DT5AV1"
title: "Extend directory new-sale onboarding"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "backend", "sales", "directory", "newsroom", "deployment"]
verify: ["npm run test", "npm run type-check", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: extend New Sales for brand-new directory businesses and custom categories, rerun article prospecting, test, commit, deploy, and verify production." }
doc_version: 2
doc_updated_at: "2026-07-30T19:29:47+00:00"
doc_updated_by: "agentctl"
description: "Allow a salesperson to sell a directory plan to a business that is not already listed, clearly distinguish new-business and existing-lead paths, accept a suggested or manually entered directory category, persist and prefill those details into the paid customer fulfillment wizard, rerun and verify article prospecting, test the complete flow, deploy to Cloud Run, and record production evidence."
---
## Summary

Extend the unified Sales Desk so a representative can start a paid directory subscription for either an existing lead or a brand-new business, capture an existing or custom category at sale time, and carry that data into post-payment fulfillment. Rerun the protected newsroom crawl and verify the review queue.

## Context

The checkout backend already reserves a deterministic directory listing id when no existing listing id is supplied, but the New Sales interface does not make that path explicit and only the customer is asked for the category later. The previous newsroom run was blocked by an exhausted Anthropic credit balance and left eight records safely retryable.

## Scope

Add an explicit new-business versus existing-lead state for directory products; use the canonical directory category suggestions with free-text entry; prefill category from selected leads and deep links; validate and persist category server-side; initialize directory intake data so the customer does not re-enter the salesperson-provided details; preserve existing listing duplicate-subscription protections and staff review; add regression tests; rerun article prospecting; deploy and verify.

## Risks

A salesperson must not be able to bypass server-owned pricing, attach an order to a missing listing, overwrite an existing category unintentionally, or publish an incomplete new listing. Category input must be bounded and normalized without preventing a legitimate custom category. Newsroom retry remains dependent on Anthropic account availability.

## Verify Steps

Run
pm run test,
pm run type-check, and
pm run build. Exercise new-business and existing-lead directory checkout paths, verify custom-category prefill into the customer intake API, visually inspect the Sales Desk at desktop and mobile widths, trigger the protected scheduler, query pending-review counts, deploy to Cloud Run, and confirm health plus production routing.

## Rollback Plan

Route Cloud Run traffic back to citybeat-web-00151-pzl. Revert the task implementation commit if the Sales Desk changes must be removed. Existing orders remain readable because the added category and intake fields are additive.

## Notes

Approved plan: track the work once, run the article crawl first, then implement the low-click directory onboarding changes using the existing industrial editorial Sales Desk design language.

