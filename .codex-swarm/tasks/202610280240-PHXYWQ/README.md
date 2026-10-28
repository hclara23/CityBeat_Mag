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
doc_updated_at: "2026-10-28T03:05:00+00:00"
doc_updated_by: "agentctl"
description: "Verify and repair published support addresses, paid directory ownership and intake recovery, and bounce feedback. No subagents; test locally before any deployment; no new spending authorized."
---
## Summary

Repair CityBeat customer email continuity and paid-order recovery. Live support/contact aliases now route to hello, which forwards to the approved operator Gmail. Super H blank description repaired with existing verified facts.

## Scope

Released staff-assisted 30-day intake recovery and bilingual fulfillment controls; original links retain their independent expiry. Existing weekly operator digest lists unfinished paid intakes; this does not automatically chase customers. Varsity advertiser owner account created and linked using owner_id, with no password set and no email auto-verification. Explicitly approved setup email delivered to thomas@varsityroofing.com. No payment changes.

## Risks

Private recovery links must go only to verified customers. Recovery creation requires sales access and MFA. Thomas must complete email verification and password setup himself. Actual provider bounce/complaint delivery and end-to-end MXroute forwarding remain unobserved; signed synthetic webhook checks passed. Directory-ingest last run failed code13; scheduler manifest has no drift.

## Verify Steps

PASS npm test; PASS npm run type-check in apps/web; PASS npm run build --workspace=@citybeat/web. Recovery tests cover independent token expiries, original link preservation, invalid tokens, unpaid/refunded/canceled/submitted/fulfilled orders. Live alias rules confirmed in mxpanel. Super H description write used update-time precondition and owner preserved.

## Rollback Plan

Route citybeat-web traffic to citybeat-web-00415-can if release regressions arise; it retains the live Resend webhook secret. Never undo customer ownership, authentication, payment or subscription data as a code rollback. Preserve hello forwarding and support/contact aliases. Private setup links remain excluded from git.

## Notes

2026-10-28 UTC release: Cloud Build 4dd2838a-32c9-413b-b804-c131a4192ff9 succeeded in 255 seconds, explicit 720-second cap. Estimated build compute about USD0.067 under user USD1 one-time approval; final invoice not available. Image sha256:cbfbdf1b50d559caa2276d6dd40223dce627eaefd74cfeb4092ec7f54eff672e, revision citybeat-web-00417-gir now 100 percent. Candidate and public 37-check smoke suites pass; candidate recovery unauthenticated401, unsigned Resend401, required email env retained. npm test and web type-check passed before build. Includes Claude ebc6b70 and Codex57a27e3/c1659bc. Resend elevatelepaso webhook5de26cdc-3552-455b-b0bf-7069e640fb73 remains enabled. Varsity setup email01a18072-c835-7c95-b6f2-fad5373e56a9 confirmed delivered. Alignment: worker operator fallback already correct; zero missed submitted briefs; support/contact aliases fixed; SuperH owner_id existed and description repaired; Varsity owner_id now linked. No further Claude deploy requested. Shared receipt here supersedes earlier pending-release notes. Remaining: customer activation, forwarding delivery observation, real provider webhook observation, existing directory-ingest failure. Broader historical audit items require separate verification; not claimed resolved.

