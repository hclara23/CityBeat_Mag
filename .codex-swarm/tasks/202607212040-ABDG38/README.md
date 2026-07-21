---
id: "202607212040-ABDG38"
title: "Unify sales and post-payment fulfillment"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212040-FQXEFT"]
tags: ["sales", "checkout", "fulfillment"]
doc_version: 2
doc_updated_at: "2026-07-21T20:40:55+00:00"
doc_updated_by: "agentctl"
description: "Deliver one low-click Sales Desk and a secure paid-order customer intake flow across directory, advertising, events, jobs, and custom products. Downstream tasks: 202607212040-KXMN5S canonical orders/checkout; 202607212040-94DM4B unified Sales Desk; 202607212040-E4YRZ8 secure customer intake; 202607212040-G73WWE product fulfillment/reporting; 202607212040-7XJF9K verification; 202607212040-HTN28A documentation/PDF; 202607212040-FQXEFT security and completeness review."
---
## Summary

Coordinate delivery of a unified salesperson checkout desk and secure post-payment fulfillment experience.

## Context

CityBeat currently splits salesperson pipeline and checkout tools, while jobs, events, directory listings, and advertising collect different data through disconnected flows.

## Scope

Track the canonical catalog, sales-order checkout engine, unified Sales Desk, customer intake wizard, fulfillment adapters, reporting, tests, documentation, and final review.

## Risks

Payment regressions, inconsistent legacy product records, unauthorized order access, and incomplete customer submissions are the primary risks.

## Verify Steps

Confirm every downstream task is DONE, all recorded quality gates pass, and final review has no unresolved findings.

## Rollback Plan

Revert downstream implementation commits and restore the previous Sales Desk routes and Stripe fulfillment behavior.

## Notes

Approved by the user on 2026-07-21. No deployment is included in this task.

