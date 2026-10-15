---
id: "202610151955-098Z3A"
title: "Configure platform manual payouts and editor payout behavior"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610151955-H80208", "202610151955-D5BBRV"]
tags: ["stripe", "connect", "configuration"]
comments:
  - { author: "CODER", body: "Start: implement Stripe invoice subscription compatibility and focused renewal commission regression coverage; no dashboard changes or fund movement." }
doc_version: 2
doc_updated_at: "2026-10-15T20:05:02+00:00"
doc_updated_by: "agentctl"
description: "After the forensic and policy audits, configure only the CityBeat platform Stripe balance to retain CityBeat funds under manual payouts and configure the editor-connected account to pay earned commissions on the approved after-clearance schedule. Do not move funds, create catch-up transfers, or change editor bank details; capture before-and-after evidence and preserve Connect transfers."
---
## Summary

Configure the CityBeat platform for manual owner payouts while preserving the approved connected-editor payout behavior after the audits are complete.

## Context

CityBeat wants its platform share retained in Stripe, while editor commission should be transferred and paid out on the approved after-clearance cadence. These are separate platform and connected-account controls.

## Scope

Capture current schedules and pending states; change only the platform payout schedule to manual; configure or verify the editor-connected payout cadence approved from research; preserve Connect transfer attribution and bank destination; document before-and-after evidence. Do not move funds.

## Risks

Changing the wrong account schedule could delay editor funds or cash out CityBeat funds. Pending payouts may already be queued. Stripe capabilities vary by connected-account type. Stop before any action that would initiate fund movement.

## Verify Steps

Verify the selected Stripe account context before each setting; confirm platform payouts are manual; confirm editor payouts follow the approved schedule; verify Connect transfers remain enabled; confirm no payout, transfer, bank change, or customer charge was created.

## Rollback Plan

Use captured prior settings to restore only the affected payout schedule if verification fails. Do not attempt financial reversals; escalate any already-queued payout separately.

## Notes

Implemented a version-compatible Stripe invoice subscription resolver for legacy invoice.subscription and current invoice.parent.subscription_details.subscription shapes. Applied it to renewal residual accrual, payment ledger recording, success/failure status changes, renewal refund order lookup, and referral invoice consumption. The existing seven-day refund hold and twice-monthly commission cycle were deliberately unchanged: shortening them would alter the documented commission/refund policy. No Stripe setting, transfer, payout, refund, charge, or deployment was performed. Verification: npx tsx --test apps/web/src/lib/stripe-invoice.test.ts apps/web/src/lib/payout-split.test.ts (19/19 passed); npm run type-check --workspace=@citybeat/web (passed). Stripe UI still needs the platform payout schedule changed to manual and the connected editor payout schedule verified separately.

