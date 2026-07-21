---
id: "202607212017-8JVTY5"
title: "Harden recurring card billing"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["backend", "code", "stripe"]
verify: ["npm run type-check"]
doc_version: 2
doc_updated_at: "2026-07-21T20:18:12+00:00"
doc_updated_by: "agentctl"
description: "Strengthen the sales checkout API so recurring products always create safe Stripe subscriptions, reuse validated customer records where appropriate, prevent duplicate active subscriptions, prefill customer data, and leave one-time charges unchanged."
---
## Summary

Make recurring sales checkout reliably create automatic card-on-file subscriptions while retaining the existing one-time custom-sale behavior.

## Context

The sales checkout already uses Stripe Checkout subscription mode for directory plans, but it does not validate an existing listing before reuse, block duplicate active subscriptions, or reuse a validated Stripe customer for a faster repeat checkout.

## Scope

Validate recurring customer email and selected listings, detect active or trialing directory subscriptions, safely reuse a listing Stripe customer where appropriate, configure optimized Stripe Checkout parameters, preserve attribution metadata, and leave custom one-time payment semantics unchanged.

## Risks

An unvalidated customer identifier could expose another customer payment method, while an incorrect duplicate check could block legitimate reactivation. Only customer IDs read from the validated listing may be reused.

## Verify Steps

Run npm run type-check and targeted automated tests for checkout classification, required recurring email, validated customer reuse, duplicate subscription rejection, and one-time behavior.

## Rollback Plan

Revert the backend commit to restore the existing Stripe Checkout session parameters. No database migration or existing subscription mutation is required.

## Notes

CityBeat must never receive, log, or store raw card data. Stripe Checkout remains the payment-data collection surface.

