---
id: "202610090047-FYXN31"
title: "Secure business-owned listings and add verified print recognition"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "6a481b99866826b29ab89cc5d589de4c4db5634e", message: "✨ FYXN31 add secure Google entry and verified print recognition; harden claims and owner notifications" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Approved secure ownership, notification and Google profile assessment with three staff-managed print badges and authorized historical Premier cover." }
  - { author: "ORCHESTRATOR", body: "verified: Google sign-in, ownership safeguards and staff-only print badges live on citybeat-web-founders-714aca9. | details: Premier archival cover published 2026-10-09T02:06:21.871298Z.; Live English cover and public auth rejection verified.; Google Business Profile sync remains disabled pending policy clearance.; Actual customer OAuth not exercised." }
doc_version: 2
doc_updated_at: "2026-10-09T02:09:21+00:00"
doc_updated_by: "agentctl"
description: "Approved: audit edit permissions; Google sign-in and verified claims; owner dashboard notifications; assess permitted Google Business Profile sync; staff-only print coverage, advertiser and cover badges with Premier cover recognition. No new spending approved."
---
## Summary

Approved owner-managed directory with secure editing, Google account entry, business notifications, policy-safe Google profile integration assessment, and staff-assigned print recognition.

## Context

User approved ownership controls, Google sign-in and staff-managed print badges. October-November historical Premier cover approved unchanged, issue year unspecified. Google sign-in provider already enabled; added citybeatmag.co to existing Firebase authorized domains. Current code graph predates listing ownership, so current source and permission tests were used.

## Scope

ORCHESTRATOR coordinates; CODER implements scoped changes; TESTER and REVIEWER verify; INTEGRATOR closes. Audit anonymous, owner, manager and staff access. Reuse existing Google login and claims/dashboard. Add Print Coverage, Print Advertiser and Cover Feature badges with staff-only writes and public display. Premier cover from October-November issue explicitly approved as historical cover despite former staff. Assess GBP sync official policies before any activation.

## Risks

No ownership grant from Google email alone. Owners must not self-award editorial badges. Distinguish ads from independent coverage. Cover is historical, not current team. GBP API reuse and project approval may block syncing. No new charges, paid deployment or external permission changes without explicit approval.

## Verify Steps

Permission boundary unit/integration tests; anonymous no-op PATCH denial; staff-only badge validation tests; Google login/claim/dashboard flow checks; typecheck, tests, build; production visual checks only after authorized deployment.

## Rollback Plan

Revert only scoped code commits; preserve existing owner/billing/content records and old assets; record any Premier badge patch previous state before writing; deployment rollback to previous healthy revision.

## Notes

Google sign-in, ownership safeguards and staff-only print badges live on citybeat-web-founders-714aca9. Premier archival cover published 2026-10-09T02:06:21.871298Z. Live English cover and public auth rejection verified. Google Business Profile sync remains disabled pending policy clearance. Actual customer OAuth not exercised.

