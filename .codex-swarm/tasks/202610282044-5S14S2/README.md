---
id: "202610282044-5S14S2"
title: "Complete CityBeat Twilio campaign and SMS consent"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
comments:
  - { author: "CODER", body: "Start: add explicit bilingual SMS claim consent and server enforcement; update SMS terms and verify locally before deployment." }
  - { author: "CODER", body: "Add explicit bilingual SMS claim consent | details: require affirmative current-version consent before sending and record disclosure evidence; match verification SMS copy and publish public consent instructions and SMS terms; local type check and consent tests pass; deployment and campaign submission remain pending" }
doc_version: 2
doc_updated_at: "2026-10-28T20:46:49+00:00"
doc_updated_by: "agentctl"
description: "Replace ResCore campaign content with CityBeat transactional messaging, add verifiable SMS consent disclosures, and validate registration. User approved Twilio 15 USD vetting and 10 USD monthly fees."
---
## Summary

Replace ResCore campaign with CityBeat transactional SMS and add explicit, verifiable claim consent. Local website correction is ready; deployment and Twilio registration remain pending.

## Context

Twilio automated validation rejected the prior claim-page evidence for missing SMS disclosures. CityBeat is operated by Elevate El Paso, as confirmed by the user.

## Scope

Bilingual public claim instructions, unchecked consent checkbox, server consent gate and evidence, matching code SMS copy, and bilingual SMS terms. Twilio fields managed separately by orchestrator.

## Risks

Deployment required before registration evidence is live. Strict consent version rejects old clients until refresh. No messages sent and no paid infrastructure actions performed during local verification.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web, node --import tsx --test apps/web/src/lib/claim-sms-consent.test.ts (2 tests), and git diff --check. After deployment verify public disclosures and checkbox, then rerun Twilio check.

## Rollback Plan

Revert the scoped implementation commit and redeploy through the existing deployment workflow. Do not remove consent requirements while sending SMS.

## Notes

No push or deployment performed. Keep task DOING until the orchestrator verifies live evidence and submits the campaign.

