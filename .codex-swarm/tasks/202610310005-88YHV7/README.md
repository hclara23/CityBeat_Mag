---
id: "202610310005-88YHV7"
title: "Publish claim buttons and activate CityBeat Twilio sender"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610302355-3CAK30"]
tags: []
comments:
  - { author: "CODER", body: "Start: publish verified claim actions and configure existing Twilio sender within approved USD 1 deployment budget" }
  - { author: "CODER", body: "start: stage CityBeat Twilio runtime credentials with existing traffic preserved and publish approved claim button release" }
doc_version: 2
doc_updated_at: "2026-10-31T00:06:08+00:00"
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
Confirm campaign VERIFIED, sender association, runtime variable presence, successful gated deployment, public bilingual claim links, eligibility APIs, and unsigned request rejection. Prior real delivery and code verification succeeded in both languages against the same handlers in an isolated fixture.

## Rollback Plan
Return traffic to citybeat-web-00454-vav if deployment health fails. Remove only newly added Twilio variables if activation must be rolled back. Preserve all other service configuration and public listing ownership.

