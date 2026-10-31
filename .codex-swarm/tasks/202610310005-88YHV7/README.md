---
id: "202610310005-88YHV7"
title: "Publish claim buttons and activate CityBeat Twilio sender"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610302355-3CAK30"]
tags: []
commit: { hash: "e49c3b36fe99a4b8a00876b53a52ff20113229a2", message: "🚧 88YHV7 start: stage CityBeat Twilio runtime credentials with existing traffic preserved and publish approved claim button release" }
comments:
  - { author: "CODER", body: "Start: publish verified claim actions and configure existing Twilio sender within approved USD 1 deployment budget" }
  - { author: "CODER", body: "start: stage CityBeat Twilio runtime credentials with existing traffic preserved and publish approved claim button release" }
  - { author: "CODER", body: "verified: publish bilingual claim buttons and activate verified Twilio sender | details: all ten property endpoints pass and no extra SMS sent" }
doc_version: 2
doc_updated_at: "2026-10-31T00:17:56+00:00"
doc_updated_by: "agentctl"
description: "Deploy tested bilingual apartment claim buttons and connect approved Twilio sender within USD 1 cloud deployment cap. Verify all ten properties in both languages without sending additional SMS."
---
## Summary

Publish the tested bilingual claim buttons and connect the verified CityBeat Twilio sender.

## Scope

Configure the existing Cloud Run service using the user-supplied Twilio credentials without storing secrets in source or command output. Preserve existing environment and traffic until deployment checks pass. Deploy the committed claim buttons and verify all ten properties in English and Spanish. User approved USD 1 for Google Cloud deployment costs.

## Risks

The two-message SMS allowance is consumed. Do not send additional texts. Keep scraped-number relay and operational SMS off. Existing campaign metadata includes legacy opt-in wording; inspect whether it is editable without new vetting fees before changing it. Runtime credentials use the existing restricted Cloud Run service configuration with no new secret-service subscription.

## Verify Steps

Deployment 41148371063 completed successfully at commit e49c3b36fe99. Cloud Build 51a52061-1d8c-43a1-924b-94b0f6c4f046 passed; candidate smoke tests and public live checks passed. Active revision citybeat-web-00457-qic serves 100 percent. Its three Twilio values match the supplied credentials; those credentials authenticate successfully and campaign remains VERIFIED. Relay and alert SMS remain disabled. verify-live.mjs passed 20 bilingual detail pages, 20 claim pages, ten eligibility APIs, and 20 unsigned POST rejections with zero messages sent. Browser confirms live Spanish top claim banner and English signed-in unchecked consent/disabled request. Prior two real texts and both code-verification flows passed in task 3CAK30. No new subscription or actual payment was created; actual cloud billing is not yet finalized.

## Rollback Plan

Return traffic to citybeat-web-00454-vav if deployment health fails. Remove only newly added Twilio variables if activation must be rolled back. Preserve all other service configuration and public listing ownership.

