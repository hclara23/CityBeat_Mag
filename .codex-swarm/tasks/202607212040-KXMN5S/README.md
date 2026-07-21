---
id: "202607212040-KXMN5S"
title: "Build canonical sales order and checkout engine"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["backend", "code", "stripe"]
verify: ["npm test"]
doc_version: 2
doc_updated_at: "2026-07-21T20:40:56+00:00"
doc_updated_by: "agentctl"
description: "Centralize the product catalog, server-authoritative pricing and cadence, sales-order lifecycle, Stripe metadata, recurring card billing, Founding availability, and consistent salesperson attribution."
---
## Summary

Create one server-authoritative catalog and sales-order lifecycle for every sellable CityBeat product.

## Context

Pricing and product behavior are currently duplicated across directory, ad, event, job, and salesperson checkout routes.

## Scope

Centralize product identifiers, names, prices, cadence, intake type, Stripe checkout parameters, Founding availability, order records, success metadata, and salesperson attribution.

## Risks

Price drift, duplicate subscriptions, webhook replay, and changing existing checkout semantics.

## Verify Steps

Run npm test and add focused tests for catalog validation, server pricing, recurring billing, order creation, and webhook state transitions.

## Rollback Plan

Revert the catalog and order modules and restore callers to their previous checkout implementations.

## Notes

Recurring products must use Stripe subscriptions and retain the payment method; one-time products remain one-time charges.

