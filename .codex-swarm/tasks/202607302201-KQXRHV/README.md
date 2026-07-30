---
id: "202607302201-KQXRHV"
title: "Restore owner godmode and unify developer access"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "roles", "security", "production", "frontend", "backend"]
verify: ["npm test", "npm run lint", "npm run type-check"]
commit: { hash: "8f3b48bca1024a9a23461c5b9bc38bca0cc7434a", message: "✨ 202607302201-KQXRHV restore owner godmode and unify developer access" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Restore the confirmed owner account to unrestricted developer access and eliminate inconsistent role resolution without elevating unrelated users." }
  - { author: "ORCHESTRATOR", body: "verified: Restored the owner account to complete developer access, preserved the Yahoo account as non-developer, passed 56 tests plus lint, type checking, and production build, deployed revision citybeat-web-00157-zlx at 100% traffic, purged the stale Hosting cache, and passed public production smoke checks." }
doc_version: 2
doc_updated_at: "2026-07-30T22:23:46+00:00"
doc_updated_by: "agentctl"
description: "Identify the CityBeat owner account, restore unrestricted developer/superadmin capabilities, keep citybeatmag@yahoo.com non-developer, unify legacy role checks, test, deploy, and verify production access."
---
## Summary

Restore the CityBeat owner account to complete cumulative developer access, fix the login redirect that sent developers to the smaller editor dashboard, and centralize role capability resolution across authentication, navigation, pages, and APIs.

## Context

The production owner account resolved as developer but lacked stored can_manage_platform and advertiser flags. The login page checked editor before developer, producing the Admin Control screen in the user's screenshot. A migrated legacy owner profile also exists.

## Scope

Normalize both owner profile records to developer plus every cumulative role; keep citybeatmag@yahoo.com explicitly non-developer; add audited production role changes; centralize effective capabilities and dashboard destination; harden developer server access; expand Developer Control module visibility; update the user guide and tests.

## Risks

Privilege changes affect production authorization. Limit elevation to the confirmed owner email, preserve the Yahoo editor restriction, avoid elevating ordinary customers, require MFA on developer routes, audit external changes, and keep server authorization independent of visible navigation.

## Verify Steps

Run npm test, npm run lint, npm run type-check, and npm run build. Verify production Firestore owner profiles report every cumulative flag, the Yahoo profile is non-developer, login/Dashboard resolve to /developer, non-developers cannot access the developer route, and the deployed Developer Control exposes every module.

## Rollback Plan

Revert the implementation commit and redeploy the previous Cloud Run revision. If necessary, restore role fields from role_change_audits for task 202607302201-KQXRHV; do not alter passwords, sessions, payment data, or unrelated profiles.

## Notes

Production role normalization updated both owner profile records to the complete cumulative capability set and preserved the Yahoo stakeholder as non-developer, with three role_change_audits. Code commit 8f3b48b deployed as Cloud Run revision citybeat-web-00157-zlx at 100% traffic. Firebase Hosting was redeployed to purge a stale one-year /developer cache; unauthenticated production access now returns 307 to login with private no-store caching. Public health checks pass. Synthetic authenticated testing was not available because the local deploy identity lacks iam.serviceAccounts.signBlob; normal Firebase login is unaffected.

