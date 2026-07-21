---
id: "202607212017-7JACJZ"
title: "Streamline recurring sales checkout"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212017-MFYKEV"]
tags: ["checkout", "payments", "recurring"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: integrate the completed backend, customer handoff, and verification tasks; review payment security and one-time preservation; then close the approved recurring checkout request." }
doc_version: 2
doc_updated_at: "2026-07-21T20:32:13+00:00"
doc_updated_by: "agentctl"
description: "Track the approved recurring-checkout improvement across backend task 202607212017-8JVTY5, customer handoff task 202607212017-XSEXBE, and verification task 202607212017-MFYKEV. Acceptance requires automatic Stripe subscription renewals with saved payment methods, unchanged one-time charges, a minimal mobile link/QR flow, automated coverage, review, and committed integration."
---
## Summary

Completed the approved low-friction recurring sales checkout. Recurring products charge through Stripe subscription Checkout, keep the payment method in Stripe for automatic renewals, safely prefill eligible returning customers, and block duplicate live subscriptions. Salespeople now hand off a locally generated QR or link with clear renewal terms, and customers receive a public bilingual result page.

## Context

Directory products use Stripe subscription Checkout today, while custom advertising sales use one-time payment Checkout. The requested outcome is to make recurring card-on-file billing explicit and dependable while reducing customer effort.

## Scope

Track backend task 202607212017-8JVTY5, handoff task 202607212017-XSEXBE, and verification task 202607212017-MFYKEV. Accept only a result that preserves one-time sales, keeps raw card data entirely in Stripe, clearly discloses renewal terms, and passes the repository verification suite.

## Risks

Payment-flow changes can create duplicate subscriptions, reduce supported payment methods, or collect unnecessary data. The implementation must validate listing and Stripe customer ownership and keep webhook fulfillment compatible.

## Verify Steps

Confirmed downstream tasks 202607212017-8JVTY5, 202607212017-XSEXBE, and 202607212017-MFYKEV are DONE with task-scoped commits. Reviewed the complete 448-line feature diff for raw-card handling, customer reuse, duplicate subscriptions, one-time preservation, and public-route access. Ran 27 tests with 0 failures, all 4 workspace typechecks, lint with 0 warnings or errors, and a successful production build that generated both bilingual checkout result routes.

## Rollback Plan

Revert the task-scoped backend, frontend, and test commits. Existing Stripe subscriptions and one-time payment records remain valid because no destructive data migration is planned.

## Notes

Reviewer outcome: no blocking findings. Raw card number, CVC, and payment-method payload fields do not enter the CityBeat sales API; Stripe Checkout remains the PCI-sensitive collection surface. Recurring checkout uses subscription mode and always collects a card, while one-time checkout uses payment mode without future-use configuration. No production deployment was performed.

