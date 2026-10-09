---
id: "202610090543-9RXVMW"
title: "Build Founders business signup funnel"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "a6fd85f20ffd7a91a2d70864b1f35f4daf94b315", message: "🚧 9RXVMW start: build bilingual Founders search and claim or create funnel | details: preserve free Basic and ownership review; bill Founders once per business and standard plans per location; validate payment and duplicate safety with tests." }
comments:
  - { author: "ORCHESTRATOR", body: "start: build bilingual Founders search and claim or create funnel | details: preserve free Basic and ownership review; bill Founders once per business and standard plans per location; validate payment and duplicate safety with tests." }
  - { author: "ORCHESTRATOR", body: "verified: deploy bilingual Founders funnel and confirm public pricing and search | details: 621 automated tests pass and candidate auth rejects anonymous creation and payment; preserve subscriptions and promote verified revision to all traffic within approved build cap" }
doc_version: 2
doc_updated_at: "2026-10-09T06:21:48+00:00"
doc_updated_by: "agentctl"
description: "Approved dedicated Founders page: search or create business, verified ownership, Google sign-in, existing checkout and hard 100-business limit, Basic fallback. Build and test locally; no unapproved deployment spending."
---
## Summary

Built bilingual Founders funnel with search, Google sign-in handoff, verified claim, guided moderated Basic creation and optional checkout. User clarified Founders is one flat business fee including all locations; later standard signups remain per-location.

## Scope

Founders page/API, duplicate and ownership guards, checkout return paths/payment validation, new listing approval publishing, shared Founders quantity correction, tests and footer discovery. No production writes or subscriptions modified.

## Risks

Not deployed. Staff must verify ownership and content; missing on-file email uses support. New listings use optional public photo URL, with uploads available in owner CMS after approval. Old open checkouts with different terms require staff reconciliation, never silently reused. Duplicate legacy corpus capped at 10000 and cached for five minutes.

## Verify Steps

TypeScript check passes. Full automated suite: 601 web plus 20 shared tests, zero failures. Prior local UI checks cover search, two-location flat quote, creation preview and pending review without payment, Spanish copy, and 390px viewport with no horizontal overflow. Independent read-only REVIEWER found no release blockers in a6fd85f; legacy approved owners missing ownership_verified may require renewed review after purchase, but new approvals set this flag. Production smoke checks pending candidate build. No real payment, email or business creation used for tests.

## Rollback Plan

Restore 100 percent traffic to citybeat-web-queue-d00c9c5 if necessary; it retains the scheduled queue behavior. Preserve any pending Founders submissions for staff review. No data migration performed. Do not roll back to older immediate-publishing queue revisions.

## Notes

Deployed October 9, 2026 America/Denver within user-approved USD1 cap. Build 33d7dcf8-cb57-413a-a189-ff771fa77404 SUCCESS in 10m52s; E2_MEDIUM estimated compute USD0.033. Immutable source a6fd85f; image digest sha256:4d612b7502d29f5ab5a79c9848157b94c69af1f524888f2542d2bbd7ee61ef69. Candidate verified before promotion. Production traffic 100 percent citybeat-web-funnel-a6fd85f. Public /en/founders and /es/founders return 200; availability API 200; Premier cover story 200. Browser verifies correct flat Founders terms and search-to-selected-business Google sign-in handoff. Anonymous create and checkout return 401. No ERROR logs observed for new revision. No real payment, email, subscription migration or listing created. Screenshot .tmp/founders-live.png.

