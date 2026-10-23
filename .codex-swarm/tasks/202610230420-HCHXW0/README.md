---
id: "202610230420-HCHXW0"
title: "Repair verified paid listing owner and website data"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610221253-QF37BA"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "blocked: verified owner account and current website unavailable | details: preserve production fields until customer evidence establishes safe replacements" }
doc_version: 2
doc_updated_at: "2026-10-23T04:21:35+00:00"
doc_updated_by: "agentctl"
description: "Investigate missing owner_id and website with authoritative claim and business evidence; update only verified fields with preconditions; no analytics events purchases or billing changes."
---
## Summary

Investigated missing owner and website fields; no verified replacement values available, so production fields remain unchanged.

## Context

Varsity Roofing WZ084cO6lk7LIpR4r0Jn has null owner_id, false ownership_verified, unconsumed claim invitation expired September5, no directory_claims records, no matching profile, and successful Firebase Auth lookup for recorded business email returned no user. Approval and paid status are not proof of account ownership. Super H Automotive TJmwyo55waiFiGYp2fmu has valid existing owner but empty website; linked intake supplies no website. BBB matches business name address phone and links super-h-automotive.business.site; direct HEAD returned404. Search found no verified working official replacement.

## Scope

Read-only review of both paid listings, linked sales orders and intake, matching profiles, directory claims, Firebase Auth email lookup and public website evidence.

## Risks

Assigning a guessed UID grants access to business management and leads. Adding the obsolete website would create a broken customer action. No production mutation, email, analytics event, purchase or billing change performed.

## Verify Steps

Firestore bounded queries and exact linked order reads; Firebase accounts:lookup HTTP200 with no user for Varsity recorded contact email; BBB public profile cross-check and old website HTTP404. All reads only; no app JavaScript executed.

## Rollback Plan

No production changes to roll back. Future repair requires verified account or completed claim and a verified current website; apply conditional field updates only.

## Notes

Pending user/customer information: Varsity must identify an existing verified CityBeat account or complete account and ownership acceptance; Super H must confirm its current official website or that it has none. Do not send invitations or contact businesses without authorization. Evidence source https://www.bbb.org/us/tx/el-paso/profile/auto-maintenance/super-h-automotive-0895-99154066 .

