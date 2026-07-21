---
id: "202607212040-G73WWE"
title: "Implement product fulfillment and status reporting"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202607212040-94DM4B", "202607212040-E4YRZ8"]
tags: ["backend", "frontend", "code"]
verify: ["npm test"]
doc_version: 2
doc_updated_at: "2026-07-21T20:40:58+00:00"
doc_updated_by: "agentctl"
description: "Define complete intake schemas for directory, jobs, events, and advertising; provision fulfillment records only after payment and required intake; and expose payment, intake, fulfillment, discount, and commission statuses."
---
## Summary

Convert completed paid intake into operational directory, job, event, and advertising fulfillment records.

## Context

Legacy flows publish or collect partial data at different stages and do not expose one consistent operational status.

## Scope

Define full product-specific requirements, validate completion, provision target records after payment and intake, and expose payment, intake, fulfillment, discount, and commission status to staff.

## Risks

Premature publishing, partial record creation, duplicate fulfillment on retries, and legacy collection inconsistencies.

## Verify Steps

Run npm test with every product family, missing-field validation, idempotent fulfillment, recurring attribution, discount display, and commission coverage.

## Rollback Plan

Stop new fulfillment dispatch, preserve sales orders for audit, and revert to the previous per-product provisioning branches.

## Notes

Operational records must not be marked ready until both payment and required intake are complete.

