---
id: "202610151908-W3RZA8"
title: "Verify Stripe and editor payout readiness read-only"
status: "DOING"
priority: "high"
owner: "REVIEWER"
depends_on: []
tags: ["stripe", "payouts", "security"]
comments:
  - { author: "REVIEWER", body: "Start: audit live Stripe account, editor payout readiness, webhook health, recurring product configuration, and commission calculations using read-only evidence only." }
doc_version: 2
doc_updated_at: "2026-10-15T19:13:03+00:00"
doc_updated_by: "agentctl"
description: "Using read-only checks only, verify CityBeat live Stripe account configuration, product and recurring price, webhook health, payout readiness, editor connected-account status, bank-destination presence, commission attribution, and payout calculation records. Redact sensitive banking data and do not initiate charges, payouts, account changes, or paid services."
---
## Summary

Read-only audit completed against the authenticated live Stripe account and production CityBeat APIs. Platform payments and payouts are active, the Premium Monthly product is active at USD 19.99 per month, and the primary CityBeat webhook is active with a 0% displayed error rate. The configured editor account and default bank destination exist and have previously received USD 4.50, but Stripe flags payouts as pausing soon at USD 3,000 lifetime volume unless the representative supplies date of birth and the last four SSN digits. A second legacy thin webhook is active with a 100% displayed error rate and needs ownership review.

## Context

Live evidence captured October 15, 2026: Stripe account CityBeat (acct_1TMaM8DBCgtcnBrq); production health /api/health/payments returned status ok and can_take_payments true on revision citybeat-web-00314-qig. The configured editor UID 01a0ce57-68dd-4356-a459-274d7ee4e6db maps to citybeatmag@yahoo.com. No secret, full bank number, identity value, charge, payout, account edit, or deployment was used.

## Scope

Verified platform account status and capabilities; current balance/payout evidence; active Premium Monthly product and cadence; webhook destinations and displayed error rates; configured editor identity mapping; connected-account capabilities, payout schedule, redacted bank destination, and prior payment evidence; live commission settings; source-level allocation, refund, idempotency, and payout scheduling rules; targeted automated tests. Cloud Scheduler inventory could not be read because the active gcloud principal lacks cloudscheduler.jobs.list.

## Risks

HIGH: editor payouts are enabled now but Stripe shows Payouts paused soon; DOB and last-four SSN requirements become due at USD 3,000 lifetime connected-account volume. HIGH: legacy destination https://api.citybeatmag.co/webhooks/stripe is active and displays 100% errors; determine whether it is still required, then repair or retire it through an approved change. MEDIUM: scheduled payout-cycle/reconciliation job existence and recent execution remain unverified because local gcloud IAM denied scheduler listing. LOW: payout_settings still contains legacy service_payout_percent.directory=50, but current code explicitly ignores that field and uses SPLIT_RATES plus split_overrides; this stale value is operator-confusing. The primary https://citybeatmag.co/api/stripe/webhook destination is active, listens to 8 events, and displays 0% errors.

## Verify Steps

1. Stripe Account status showed no active tasks and active Payments and Payouts capabilities. 2. Product catalog showed Premium Directory - Monthly active at USD 19.99 per month. 3. Workbench showed the primary CityBeat webhook active with 8 events and 0% error, plus a legacy thin destination with 20 events and 100% error. 4. Editor connected account is Enabled with active Payouts and Transfers, daily two-day rolling payouts, a default credit-union bank ending 9980, USD 4.50 lifetime volume, and one succeeded USD 4.50 payment; Stripe also showed two future payout-impacting identity requirements. 5. Live payout settings showed residual mode, no split overrides, and the configured editor UID mapping to citybeatmag@yahoo.com. 6. The CityBeat sales dashboard showed the editor leaderboard at USD 4.50, matching 45% of a USD 9.99 editor-sold directory sale after cent rounding. 7. node --import tsx --test over payout-split, commission-schedule, finance-rollup, payout-reconcile-cursor, and payouts passed 48 of 48 tests. 8. npm run scheduler:check failed only at the read-only IAM inventory step with cloudscheduler.jobs.list denied.

## Rollback Plan

No financial or Stripe configuration was changed. Revert only this audit documentation commit if necessary. Any future identity completion, webhook retirement, payout test, bank change, or scheduler IAM change requires its own approved operational action.

## Notes

At USD 19.99, current default directory splits calculate as follows before any fee-headroom clamp: editor-sold: editor USD 9.00 and platform USD 10.99; rep-sold: editor USD 5.00, rep USD 8.00, platform USD 6.99; autonomous: editor USD 8.00 and platform USD 11.99. Commission is held seven days and paid on the next El Paso-local 1st or 15th. Residual mode applies the configured shares to renewals. Refunds reduce or reverse unpaid shares; already-paid refunds create a manual debt alert rather than silently withdrawing bank funds.

