---
id: "202610302355-3CAK30"
title: "Test live mock property SMS and emphasize claim actions"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610302311-DF91CQ"]
tags: []
commit: { hash: "d6b721fe6b7ca5c9d51f87a52fc37c263e3e08ae", message: "✨ 3CAK30 start: make bilingual apartment claim buttons prominent and add guarded editor SMS mock | details: verify English real delivery and claim review gating" }
comments:
  - { author: "CODER", body: "Start: emphasize bilingual claim buttons and run editor-authorized SMS test against isolated mock property; cap at two messages and USD 0.25." }
  - { author: "CODER", body: "start: make bilingual apartment claim buttons prominent and add guarded editor SMS mock | details: verify English real delivery and claim review gating" }
  - { author: "CODER", body: "verified: bilingual prominent claim actions pass browser checks | details: two real editor texts delivered and both codes verified isolated claims pending staff review; production activation remains unpublished" }
doc_version: 2
doc_updated_at: "2026-10-31T00:04:47+00:00"
doc_updated_by: "agentctl"
description: "Approved isolated editor-phone mock claim test with at most two Twilio texts and USD 0.25 cap; make bilingual property claim actions prominent; never change real property ownership or contact numbers."
---
## Summary

Make apartment claims obvious in English and Spanish and test real SMS delivery against an isolated editor mock property.

## Scope

Move all ten card claim actions above descriptive content and use filled brand buttons. Add a top-of-page manager claim banner. Extend the existing localhost test fixture with explicitly enabled real SMS, random codes, a two-attempt cap, fixed approved destination, and in-memory ownership only. Credentials are loaded from the user-provided document into process environment only, never saved in source.

## Risks

Production has no Twilio sender environment variables configured. Real delivery in the local fixture does not establish production configuration. Carrier registration is VERIFIED and sender is in its messaging service. Campaign metadata still contains an old Parkland Pointe opt-in reply; this must be reviewed before public activation. Publishing or configuring paid cloud services needs separate approval under the current spending instructions. Do not restart the live test and reuse its two-message allowance.

## Verify Steps

Type check and 14 real-handler claim tests passed, covering all ten properties in both languages and approval gating. Browser found ten prominent claim links per locale; Spanish mobile top banner opens its correct claim form. Two real two-segment SMS messages were delivered without provider errors: English SM2aa0c1420b88cd4713572d91fc14baf4 and Spanish SM1982378530061a3eccf63ae52b14f1d7. Editor supplied both received codes; each real production verification handler returned verified and pending review, confirmed in browser in its respective language. No public property changed. All two approved test messages have been used; no more sends are authorized. Provider price was not yet posted. Credentials stayed process-only. Existing automated tests confirm admin approval is required to unlock owner editing. Production sender configuration and publication are separate outstanding actions, not verified by this local test.

## Rollback Plan

Revert the two apartment presentation changes. Stop the localhost fixture to discard mock ownership and verification codes. No production property or ownership data has been changed. Current work is not deployed.

