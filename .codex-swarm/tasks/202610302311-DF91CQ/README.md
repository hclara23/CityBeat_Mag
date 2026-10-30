---
id: "202610302311-DF91CQ"
title: "Enable bilingual apartment SMS property claims"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610302249-M5S972"]
tags: []
commit: { hash: "3375d81bedd4a6d0db82739cb51d4b90f3438298", message: "🚧 DF91CQ start: connect apartment SMS claims to trusted directory records and approved manager edits | details: localize verification texts; verify all ten properties in both languages with isolated UI and backend tests; prepare release pending deployment budget approval" }
comments:
  - { author: "CODER", body: "Start: implement trusted apartment-to-directory linking and bilingual consent-based SMS claims with admin review and isolated full-flow tests." }
  - { author: "CODER", body: "start: add bilingual apartment claim screens with SMS consent and six-digit verification | details: preserve login return path and show review or approved outcomes; add claim links on all apartment cards and details" }
  - { author: "TESTER", body: "start: add isolated full apartment claim-flow tests | details: verify all ten properties in both languages through real resolver and SMS handlers; cover consent, trusted destinations, expiry, retries, provider failure, admin approval and safe public overlays" }
  - { author: "CODER", body: "start: connect apartment SMS claims to trusted directory records and approved manager edits | details: localize verification texts; verify all ten properties in both languages with isolated UI and backend tests; prepare release pending deployment budget approval" }
  - { author: "CODER", body: "verified: deployed apartment text claims in release 41144060930 | details: all twenty bilingual claim pages and ten eligibility endpoints passed live checks; language switching and sign-in return paths verified; no live SMS sent" }
doc_version: 2
doc_updated_at: "2026-10-30T23:31:44+00:00"
doc_updated_by: "agentctl"
description: "Approved: connect ten apartment properties to authenticated directory SMS claims, translate texts and consent, preserve trusted numbers and admin review, test success and failure flow without paid sends or deployment."
---
## Summary

Implement bilingual SMS claims for all ten apartment properties using the existing directory ownership, review and manager dashboard flow.

## Context

User approved bilingual apartment text claims and then explicitly approved up to USD 1 in Google Cloud deployment costs. Published the tested release using existing hosting on October 30, 2026; no live SMS messages were sent.

## Scope

Claim links and dedicated EN/ES screens; unchecked SMS consent and authenticated requests; trusted apartment-to-directory mapping; existing rate limits, code expiry, attempts and transactional verification; bilingual SMS templates and stable localized errors. Approved directory edits are reflected in public apartment cards and details. A local-only preview harness exercises real UI and route code with in-memory persistence and simulated SMS.

## Risks

Leasing tracking or landline numbers may not receive SMS; the UI offers staff review. Carrier delivery remains untested because no paid texts or recipient access were authorized. All ten live eligibility endpoints now return claimable with the expected phone endings. Isolated transaction tests do not emulate Firestore contention retries. Final billed deployment usage is not yet available.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web. Passed 34 tests across apartment-claim-flow, apartments, claim-sms-consent and sms suites. Tests exercise all ten properties in both languages through actual apartment routes, resolver, existing directory start and verify handlers, and admin approval. Covered unauthorized requests, missing/stale consent, arbitrary destination substitution, failed SMS cleanup, wrong codes, five-attempt limit, expiry, replay, intervening owner, existing record reuse, identity conflicts, unpublished data and approved-only edits. Passed git diff --check.

Browser exercised actual claim client against isolated route harness: English consent disabled until checked, simulated code request, invalid-code feedback, valid code to pending review; Spanish consent, request and valid code to localized pending review. Local Next preview confirmed Spanish rendering and unavailable fallback with production DB credentials denied. No real messages were sent. Screenshot apartment-claim-test-es.png in current conversation visualization folder.

## Rollback Plan

Revert this task's commits and redeploy with approved spending. Preserve existing directory ownership records and apartment mappings for audit; do not delete manager claims or change billing as part of rollback.

## Notes

Deployment 41144060930 succeeded for commit 3375d81bedd4a6d0db82739cb51d4b90f3438298, including candidate and production smoke checks. Cloud Build 88b26843-bf48-4545-8008-7e62954aa0f9 succeeded in about five minutes. Live checks passed all twenty EN/ES claim pages and ten claim-eligibility endpoints; unsigned start and verify requests returned 401 unauthorized. Live browser confirmed translated disclosures, correct ALZA phone ending, preserved property route on language switching, and locale-specific sign-in return paths. Screenshot apartment-claim-live.png in current conversation visualization folder. Local 34-test suite and isolated EN/ES full browser flow passed before release. No live SMS was sent and no property ownership was changed during validation. Public entry points: https://citybeatmag.co/en/apartments and https://citybeatmag.co/es/apartments. Task completed.

