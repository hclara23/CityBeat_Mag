---
id: "202610302311-DF91CQ"
title: "Enable bilingual apartment SMS property claims"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610302249-M5S972"]
tags: []
comments:
  - { author: "CODER", body: "Start: implement trusted apartment-to-directory linking and bilingual consent-based SMS claims with admin review and isolated full-flow tests." }
  - { author: "CODER", body: "start: add bilingual apartment claim screens with SMS consent and six-digit verification | details: preserve login return path and show review or approved outcomes; add claim links on all apartment cards and details" }
  - { author: "TESTER", body: "start: add isolated full apartment claim-flow tests | details: verify all ten properties in both languages through real resolver and SMS handlers; cover consent, trusted destinations, expiry, retries, provider failure, admin approval and safe public overlays" }
  - { author: "CODER", body: "start: connect apartment SMS claims to trusted directory records and approved manager edits | details: localize verification texts; verify all ten properties in both languages with isolated UI and backend tests; prepare release pending deployment budget approval" }
doc_version: 2
doc_updated_at: "2026-10-30T23:19:19+00:00"
doc_updated_by: "agentctl"
description: "Approved: connect ten apartment properties to authenticated directory SMS claims, translate texts and consent, preserve trusted numbers and admin review, test success and failure flow without paid sends or deployment."
---
## Summary

Implement bilingual SMS claims for all ten apartment properties using the existing directory ownership, review and manager dashboard flow.

## Context

User approved implementation and full claim-flow testing. The earlier USD 1 approval covered the previous apartment release. No new deployment or paid SMS sends are authorized for this change yet.

## Scope

Claim links and dedicated EN/ES screens; unchecked SMS consent and authenticated requests; trusted apartment-to-directory mapping; existing rate limits, code expiry, attempts and transactional verification; bilingual SMS templates and stable localized errors. Approved directory edits are reflected in public apartment cards and details. A local-only preview harness exercises real UI and route code with in-memory persistence and simulated SMS.

## Risks

Leasing tracking or landline numbers may not receive SMS; the UI offers staff review. Ambiguous existing directory identities are refused for review rather than overwritten. Local preview credentials cannot read Firestore (PERMISSION_DENIED), so production identity matching and carrier delivery remain release checks. No production writes, messages, deployment or new subscription occurred. Fake transactions in isolated tests do not emulate Firestore contention retries.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web. Passed 34 tests across apartment-claim-flow, apartments, claim-sms-consent and sms suites. Tests exercise all ten properties in both languages through actual apartment routes, resolver, existing directory start and verify handlers, and admin approval. Covered unauthorized requests, missing/stale consent, arbitrary destination substitution, failed SMS cleanup, wrong codes, five-attempt limit, expiry, replay, intervening owner, existing record reuse, identity conflicts, unpublished data and approved-only edits. Passed git diff --check.

Browser exercised actual claim client against isolated route harness: English consent disabled until checked, simulated code request, invalid-code feedback, valid code to pending review; Spanish consent, request and valid code to localized pending review. Local Next preview confirmed Spanish rendering and unavailable fallback with production DB credentials denied. No real messages were sent. Screenshot apartment-claim-test-es.png in current conversation visualization folder.

## Rollback Plan

Revert this task's commits and redeploy with approved spending. Preserve existing directory ownership records and apartment mappings for audit; do not delete manager claims or change billing as part of rollback.

## Notes

Task 202610302311-DF91CQ remains DOING for release approval and production verification. UI commit 3b4d482f8fc0; test/harness commit 121c15e37489. Local-only browser harness command: node --import tsx scripts/preview-apartment-claims.ts (127.0.0.1:3012). Production release will use existing Cloud Run hosting with a requested spending cap of USD 1 and no new subscription. Actual carrier delivery requires a separate authorized test recipient and SMS budget if requested.

