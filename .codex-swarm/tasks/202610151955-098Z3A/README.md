---
id: "202610151955-098Z3A"
title: "Configure platform manual payouts and editor payout behavior"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610151955-H80208", "202610151955-D5BBRV"]
tags: ["stripe", "connect", "configuration"]
commit: { hash: "bfe167eed721d982b2f5178d2602ead5ae3e3b69", message: "🛠️ 098Z3A support current Stripe renewal invoice attribution" }
comments:
  - { author: "CODER", body: "Start: implement Stripe invoice subscription compatibility and focused renewal commission regression coverage; no dashboard changes or fund movement." }
  - { author: "CODER", body: "verified: renewal invoice compatibility passed 19 focused tests and type-check | details: CityBeat platform payouts were saved as manual; editor remained daily two-day rolling; approved USD 4.50 catch-up transfer succeeded with Stripe evidence; no owner bank payout occurred." }
doc_version: 2
doc_updated_at: "2026-10-15T20:18:30+00:00"
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

1. Focused invoice compatibility and payout split tests passed 19/19. 2. Web TypeScript check passed. 3. Stripe dashboard confirmed CityBeat manual payouts saved. 4. Editor account remained Daily — 2 day rolling basis with Transfers and Payouts active. 5. USD 4.50 catch-up transfer tr_1UQv6CDBCgtcnBrqW0iYc8wp succeeded and appears as USD 4.50 future payout. 6. CityBeat retained USD 7.40 inside Stripe. 7. No production deployment has occurred yet; release and post-deploy renewal verification are separate downstream tasks.

## Rollback Plan

Use captured prior settings to restore only the affected payout schedule if verification fails. Do not attempt financial reversals; escalate any already-queued payout separately.

## Notes

Live configuration completed 2026-10-15 with explicit user approval. CityBeat platform account acct_1TMaM8DBCgtcnBrq changed from automatic daily payouts to manual payouts and Stripe confirmed the change was saved. Editor connected account acct_1TtwpdDgTTWo75qn remained on Daily — 2 day rolling basis. CityBeat had USD 11.90 in its Stripe Business account and USD 0.00 in Payments balance; USD 4.50 was transferred internally to Payments balance, then the approved catch-up commission was transferred to the editor through CityBeat's audited manual payout endpoint. Stripe transfer tr_1UQv6CDBCgtcnBrqW0iYc8wp succeeded; editor total/future payout balance became USD 4.50 and lifetime volume USD 9.00. CityBeat retained USD 7.40 inside Stripe. No owner bank payout, charge, refund, subscription change, or editor bank-setting change occurred. Editor payouts may be paused at USD 3,000 lifetime volume unless DOB and last-four SSN requirements are completed.

