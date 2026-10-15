---
id: "202610151907-QDRGY5"
title: "Audit Premium SEO, sales UX, and payout readiness"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "bd5d038824c8a9e5418a889b323781569bc3c3b3", message: "✅ 63D713 verified: production release passed branch type-check and tests, candidate deployment and smoke test, 100 percent traffic promotion, live verification, listing SEO checks, authenticated sales recovery checks, and payment health on revision citybeat-web-00316-yeq." }
comments:
  - { author: "PLANNER", body: "Approved decomposition: SEO/referral audit 202610151908-65QK5Z -> implementation 202610151908-1V8V7X; sales UI audit 202610151908-7SR37V -> hardening 202610151908-CSBGR8; read-only Stripe/editor payout readiness 202610151908-W3RZA8; combined verification 202610151908-FQ4M4R depends on both implementations and payout audit; production release 202610151908-63D713 depends on combined verification." }
  - { author: "ORCHESTRATOR", body: "Start: Execute the approved Premium SEO and pass-through, sales-flow resilience, and read-only Stripe/editor payout audits; implement and verify evidence-backed fixes without initiating financial transactions." }
  - { author: "PLANNER", body: "Dependency correction: removed the umbrella task 202610151907-QDRGY5 as an execution prerequisite from the three independent audit tasks 202610151908-65QK5Z, 202610151908-7SR37V, and 202610151908-W3RZA8. The real ordering remains unchanged: each implementation waits on its audit, combined verification waits on both implementations plus payout readiness, and release waits on combined verification." }
  - { author: "ORCHESTRATOR", body: "verified: completed Premium SEO and pass-through improvements, resilient sales-flow hardening, read-only Stripe and editor payout readiness checks, combined regression testing, and verified production release | details: documented remaining editor identity, legacy webhook, scheduler IAM, and Super H onboarding follow-ups." }
doc_version: 2
doc_updated_at: "2026-10-15T19:49:02+00:00"
doc_updated_by: "agentctl"
description: "Verify and improve Premium-listing SEO value and measurable pass-through traffic; review and harden the end-to-end sales UI so sales cannot stall mid-flow; and read-only validate CityBeat Stripe plus editor payout-account readiness without initiating charges, payouts, or banking changes."
---
## Summary

Completed the Premium growth audit, implementation, combined regression verification, and production release. Premium listings now provide measurable CityBeat referral attribution, granular outbound-action analytics, stronger localized metadata and structured data, and resilient sales checkout recovery. Stripe payments and the editor payout destination are currently operational.

## Scope

Completed downstream tasks 202610151908-65QK5Z, 202610151908-1V8V7X, 202610151908-7SR37V, 202610151908-CSBGR8, 202610151908-W3RZA8, 202610151908-FQ4M4R, and 202610151908-63D713. Released to Cloud Run revision citybeat-web-00316-yeq.

## Risks

Editor payouts are enabled now, but Stripe warns they will pause at USD 3,000 lifetime connected-account volume unless the account representative supplies date of birth and the last four SSN digits. A legacy api.citybeatmag.co Stripe webhook remains active with a 100 percent displayed error rate and needs a separate owner decision to repair or retire. Cloud Scheduler inventory could not be read with the current local Google Cloud IAM. Super H remains Basic until payment and needs Premium onboarding content to realize the full SEO benefit.

## Verify Steps

Passed 82 focused regressions, web TypeScript validation, 611 web tests, and 20 shared-library tests. Production deployment run 38795139959 passed candidate and live checks. Super H returned HTTP 200 with canonical, x-default hreflang, and LocalBusiness schema. Payment health returned ok and can_take_payments true. Stripe showed platform Payments/Payouts active, Premium Monthly active at USD 19.99/month, the primary webhook at zero displayed errors, and the editor connected account with payouts/transfers enabled plus a prior successful USD 4.50 payment.

## Rollback Plan

Revert the scoped production commits or route Cloud Run traffic to the prior revision. Analytics changes preserve legacy aggregates. No financial transaction, payout, bank change, identity submission, or Stripe configuration change occurred.

## Notes

Premium benefits are real: priority directory and best-page placement, richer content, and a do-follow business backlink. The release adds CityBeat attribution and granular action reporting. Remaining operational actions involving editor identity or legacy webhook retirement require the appropriate account owner and separate approval.

