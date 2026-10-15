---
id: "202610152030-RDM0NQ"
title: "Reconcile and send editor year-to-date commission statement"
status: "TODO"
priority: "high"
owner: "REVIEWER"
depends_on: []
tags: ["stripe", "reconciliation", "email", "reporting"]
doc_version: 2
doc_updated_at: "2026-10-15T20:31:26+00:00"
doc_updated_by: "agentctl"
description: "Reconcile both 2026 .50 editor commissions and their Stripe transaction references, prepare the .00 year-to-date statement, and send it from the configured CityBeat email address to citybeatmag@yahoo.com. Do not initiate another transfer."
---
## Summary

Reconcile and deliver the editor's 2026 year-to-date statement for two .50 commissions totaling .00.

## Scope

Recover both Stripe transaction references, distinguish Connect transfers from bank payouts, render the statement, and email it from the configured CityBeat address to citybeatmag@yahoo.com without sending another transfer.

## Risks

Incorrect transaction mapping, duplicate email delivery, mislabeling transfer status as bank settlement, or accidental financial action.

## Verify Steps

Match both .50 ledger entries to Stripe references, confirm .00 YTD, preview recipient and sender, send once, and record delivery evidence.

## Rollback Plan

If reconciliation fails, do not send; correct and regenerate the statement. Sent email cannot be recalled, so preserve the verified copy and issue a correction if needed.

