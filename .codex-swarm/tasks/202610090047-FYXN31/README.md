---
id: "202610090047-FYXN31"
title: "Secure business-owned listings and add verified print recognition"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:48:41+00:00"
doc_updated_by: "agentctl"
description: "Approved: audit edit permissions; Google sign-in and verified claims; owner dashboard notifications; assess permitted Google Business Profile sync; staff-only print coverage, advertiser and cover badges with Premier cover recognition. No new spending approved."
---
## Summary

Approved owner-managed directory with secure editing, Google account entry, business notifications, policy-safe Google profile integration assessment, and staff-assigned print recognition.

## Scope

ORCHESTRATOR coordinates; CODER implements scoped changes; TESTER and REVIEWER verify; INTEGRATOR closes. Audit anonymous, owner, manager and staff access. Reuse existing Google login and claims/dashboard. Add Print Coverage, Print Advertiser and Cover Feature badges with staff-only writes and public display. Premier cover from October-November issue explicitly approved as historical cover despite former staff. Assess GBP sync official policies before any activation.

## Risks

No ownership grant from Google email alone. Owners must not self-award editorial badges. Distinguish ads from independent coverage. Cover is historical, not current team. GBP API reuse and project approval may block syncing. No new charges, paid deployment or external permission changes without explicit approval.

## Verify Steps

Permission boundary unit/integration tests; anonymous no-op PATCH denial; staff-only badge validation tests; Google login/claim/dashboard flow checks; typecheck, tests, build; production visual checks only after authorized deployment.

## Rollback Plan

Revert only scoped code commits; preserve existing owner/billing/content records and old assets; record any Premier badge patch previous state before writing; deployment rollback to previous healthy revision.

