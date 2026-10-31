---
id: "202610310121-17SP0E"
title: "Publish property management promotion and verify bilingual production flows"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610310017-E9QP6H"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: publish the tested property portfolios under the approved USD 1 deployment cap and verify bilingual production pages" }
doc_version: 2
doc_updated_at: "2026-10-31T01:22:13+00:00"
doc_updated_by: "agentctl"
description: "User explicitly approved up to USD 1 Google Cloud build/deployment usage to publish E9QP6H and verify both languages live. Use existing deployment pipeline and hosting. No outreach or live test charges authorized."
---
## Summary
Publish the tested property-management promotion and corporate portfolios using the existing Cloud Run pipeline.

## Context
The user explicitly approved up to USD 1 in Google Cloud build/deployment usage for this release. Implementation is 4e7874d, closure aae6051; 123 targeted tests and an isolated production build passed.

## Scope
Push the committed release, monitor CI and the candidate deployment, verify production English/Spanish promotion and company pages, and check unauthenticated API boundaries without submitting real claims or payments.

## Risks
Keep build/deployment usage within USD 1. Do not initiate outreach, paid Stripe tests, SMS, new subscriptions, or ownership changes. Existing pipeline gates candidate traffic and rolls back failed live checks.

## Verify Steps
Confirm the GitHub deploy job succeeds for the pushed head, check the serving Cloud Run revision, inspect bilingual public pages in the browser, and confirm private corporate APIs reject anonymous requests. Record exact run and revision evidence.

## Rollback Plan
If live smoke checks fail, restore the previous Cloud Run revision and inspect the failure before another build. Preserve existing customer data and billing state.

## Notes
No deployment has occurred yet. This task is separate from the completed local implementation task E9QP6H.

