---
id: "202610280240-PHXYWQ"
title: "Repair paid customer onboarding and email continuity"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Repair email aliases and paid intake recovery; verify ownership against owner_id and preserve customer entitlements." }
doc_version: 2
doc_updated_at: "2026-10-28T02:45:43+00:00"
doc_updated_by: "agentctl"
description: "Verify and repair published support addresses, paid directory ownership and intake recovery, and bounce feedback. No subagents; test locally before any deployment; no new spending authorized."
---
## Summary

Repair CityBeat customer email continuity and paid-order recovery. Live support/contact aliases now route to hello, which forwards to the approved operator Gmail. Super H blank description repaired with existing verified facts.

## Scope

Staff-assisted 30-day intake recovery endpoint and bilingual fulfillment UI; independent recovery token preserves original token; unfinished paid orders recur in existing weekly ops digest. No deployment or customer email sent. No ownership reassignment.

## Risks

Recovery links grant private order access and must go only to verified customers. Endpoint requires sales access and MFA. Resend browser account is unrelated and needs owner sign-in. Varsity has no owner_id or matching contact-email profile. Super H has owner_id already; owner_user_id was the wrong field.

## Verify Steps

PASS npm test; PASS npm run type-check in apps/web; PASS npm run build --workspace=@citybeat/web. Recovery tests cover independent token expiries, original link preservation, invalid tokens, unpaid/refunded/canceled/submitted/fulfilled orders. Live alias rules confirmed in mxpanel. Super H description write used update-time precondition and owner preserved.

## Rollback Plan

Revert task code commit before deployment. Remove only support and contact aliases to undo this task's email routing; retain previously approved hello forwarding. Super H description prior value empty; backup is .tmp/super-h-description-before.json. Never revert owner_id or payment data.

## Notes

Pending: CityBeat Resend account access and signing-secret configuration; verified Varsity owner registration/claim; end-to-end forwarding delivery; deployment authorization/cost cap and live checks. Full application readiness is not yet established.

