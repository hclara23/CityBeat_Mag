---
id: "202610151954-5E6SNV"
title: "Audit and repair Stripe recurring commissions and payout reporting"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-15T19:55:06+00:00"
doc_updated_by: "agentctl"
description: "Trace the active .99 monthly subscription through Stripe invoices, commission attribution, Connect transfers, and bank payouts; keep CityBeat platform funds in Stripe under manual payouts; ensure editor commissions move after funds clear; research payout-frequency requirements; implement monthly connected-payee statements and notifications; calculate but do not transfer any catch-up amount without separate approval."
---
## Summary

Audit and correct CityBeat Stripe platform and Connect behavior so the recurring .99 subscription credits the editor every eligible renewal, CityBeat funds remain in Stripe until manually paid out, connected payees receive commissions after funds clear, and monthly statements are delivered.

## Scope

Read-only forensic audit of Stripe invoices, subscription metadata, commission ledger, transfers and payouts; legal and Stripe schedule research; implementation of recurring attribution fixes if required; platform manual-payout configuration; connected-payee payout scheduling; monthly statement generation and email delivery. No catch-up transfer or other movement of funds without separate exact-dollar approval.

## Risks

Financial configuration can delay or misroute funds; recurring metadata may be incomplete; legal classification and contract terms may affect payout timing; reports must avoid exposing sensitive banking data. Preserve the editor connected account and do not initiate charges, refunds, transfers, or payouts during the audit.

## Verify Steps

Reconcile every successful .99 invoice against the commission ledger, Connect transfers, and payouts; verify CityBeat platform payout schedule is manual; verify editor payout behavior after balance availability; run focused payout/webhook/report tests; validate monthly statement totals and email recipient scoping; document legal and Stripe schedule sources.

## Rollback Plan

Restore prior payout schedule configuration and deployed revision; disable the reporting scheduler; revert code through the task commit. Financial movements are excluded from automatic remediation and require a separately approved transaction plan.

