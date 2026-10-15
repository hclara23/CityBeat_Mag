---
id: "202610152030-YPJ8P9"
title: "Implement editor payout cadence and attached statements"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["code", "backend", "stripe", "email"]
verify: ["npm test", "npm --prefix apps/web run type-check"]
comments:
  - { author: "CODER", body: "Start: replace first-and-fifteenth payout logic with fifteenth-and-final-day scheduling; attach idempotent statements to each editor transfer while preserving manual platform payouts." }
doc_version: 2
doc_updated_at: "2026-10-15T20:31:24+00:00"
doc_updated_by: "agentctl"
description: "Change eligible editor commission transfers to the 15th and final calendar day in America/Denver, keep CityBeat platform payouts manual, and produce an idempotent commission statement with every editor transfer."
---
## Summary

Run eligible editor commission transfers on the 15th and final calendar day in America/Denver and attach an idempotent statement to each cycle.

## Scope

Update cadence guards, scheduler behavior, payout policy copy, cycle idempotency, statement generation, delivery, and audit records while leaving platform payouts manual.

## Risks

Month-length and timezone errors, duplicate transfers or emails, cleared-fund misclassification, and accidental changes to platform payout settings.

## Verify Steps

Run focused payout and statement tests plus type-check; cover the 15th, every possible month-end, leap years, retries, refunds, and empty cycles.

## Rollback Plan

Revert cadence and scheduler configuration to the prior disabled release state; leave recorded transfers and delivered statements intact.

