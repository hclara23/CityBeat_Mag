---
id: "202610090010-J4ZN9F"
title: "CYO Studio legal documents"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:24:57+00:00"
doc_updated_by: "agentctl"
description: "Audit and update legal documents for the publicly reachable CYO Studio application in C:\\dev\\CYO."
---
## Summary

Updated CYO Studio privacy and terms and added a cookie notice.

## Scope

Covered memberships, Stripe, attendance, bikes, waitlists, ride metrics, emergency contacts, waivers, incidents, staff notes, Firebase, and data rights.

## Risks

Waivers and membership terms remain subject to applicable local law and counsel review.

## Verify Steps

npm test; npm run build — 12 tests and build passed in C:\dev\CYO.

## Rollback Plan

Revert CYO commit 46bec4b.

## Notes

External repository commit: 46bec4b.

