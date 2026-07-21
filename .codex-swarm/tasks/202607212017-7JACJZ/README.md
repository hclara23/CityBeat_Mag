---
id: "202607212017-7JACJZ"
title: "Streamline recurring sales checkout"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212017-MFYKEV"]
tags: ["checkout", "payments", "recurring"]
doc_version: 2
doc_updated_at: "2026-07-21T20:18:11+00:00"
doc_updated_by: "agentctl"
description: "Track the approved recurring-checkout improvement across backend task 202607212017-8JVTY5, customer handoff task 202607212017-XSEXBE, and verification task 202607212017-MFYKEV. Acceptance requires automatic Stripe subscription renewals with saved payment methods, unchanged one-time charges, a minimal mobile link/QR flow, automated coverage, review, and committed integration."
---
## Summary

Coordinate and close the approved low-friction recurring sales checkout improvement across backend safeguards, the customer link and QR experience, automated verification, review, and integration.

## Context

Directory products use Stripe subscription Checkout today, while custom advertising sales use one-time payment Checkout. The requested outcome is to make recurring card-on-file billing explicit and dependable while reducing customer effort.

## Scope

Track backend task 202607212017-8JVTY5, handoff task 202607212017-XSEXBE, and verification task 202607212017-MFYKEV. Accept only a result that preserves one-time sales, keeps raw card data entirely in Stripe, clearly discloses renewal terms, and passes the repository verification suite.

## Risks

Payment-flow changes can create duplicate subscriptions, reduce supported payment methods, or collect unnecessary data. The implementation must validate listing and Stripe customer ownership and keep webhook fulfillment compatible.

## Verify Steps

Require all downstream tasks to be DONE, review their diffs and verification logs, run the complete declared verification suite, and confirm the final repository is clean with task-scoped commits.

## Rollback Plan

Revert the task-scoped backend, frontend, and test commits. Existing Stripe subscriptions and one-time payment records remain valid because no destructive data migration is planned.

## Notes

No production deployment is included in this request. Deployment remains a separately authorized operation.

