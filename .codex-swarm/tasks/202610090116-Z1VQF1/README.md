---
id: "202610090116-Z1VQF1"
title: "Activate Premier 30-day Premium promotion and flat Founders offer"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T01:17:49+00:00"
doc_updated_by: "agentctl"
description: "Approved Premier-only 30-day complimentary Premium grant. $9.99 per month total for all three locations via customer opt-in checkout. Automatic Basic fallback without paid subscription; retain ownership and print recognition. Dr. Karina Mendoza recipient; draft messages require confirmation before sending. Reuse existing expiry scheduler and total $1 release build cap."
---
## Summary

Premier-only 30-day complimentary Premium with an explicit $9.99 monthly total Founders offer and automatic Basic fallback without losing ownership or historical print recognition.

## Scope

CODER extends existing complimentary tier helpers, expiry scheduler and checkout with a private Premier offer for all three locations. TESTER checks exact expiry, paid-state race safety, flat checkout quantity, UI terms and preserved owner/badge fields. REVIEWER audits; ORCHESTRATOR deploys within combined USD1 approved cap and activates bounded grant. Recipient Dr. Karina Mendoza; prepare invitation and reminder for confirmation before sending.

## Risks

Never charge automatically, create subscriptions, assign ownership without verified acceptance, change location count for billing, leak recipient email, overwrite a simultaneous paid subscription, or remove print recognition. Existing public pricing is per-location; private offer must explicitly bill quantity1 while retaining three business locations. Invitations/reminders stay disabled until approved.

## Verify Steps

Pure tests for exact 30-day expiry, flat $9.99 pricing eligibility and preservation of ownership/print fields; typecheck, lint, all tests, cloud build; live listing/API promotion terms and anonymous checkout denial; scheduler enabled and dry-run.

## Rollback Plan

Restore only promotion fields from atomic audit snapshot; revert promotion code commit and route traffic to prior healthy release. Never cancel an existing customer subscription or remove owner/print records.

