---
id: "202610310550-5SJP88"
title: "Activate Cloudflare dashboard reporting"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: user-approved Cloudflare Account Analytics Read token created and locally protected with Windows DPAPI. API validation blocked by automatic policy review." }
  - { author: "ORCHESTRATOR", body: "blocked: created approved Cloudflare read-only token and protected it with Windows DPAPI | details: recorded verified account and site configuration; automatic policy review blocked live API validation before runtime installation." }
  - { author: "ORCHESTRATOR", body: "Start: renewed user authorization allowed credential test; all ranges work after correcting date schema. Prepare query fix and secure deployment configuration." }
  - { author: "ORCHESTRATOR", body: "start: correct Cloudflare daily reporting schema and UTC range boundaries | details: add regression coverage; validate all live API ranges and encrypted deployment secret; prepare tested release pending spending approval." }
doc_version: 2
doc_updated_at: "2026-10-31T05:56:56+00:00"
doc_updated_by: "agentctl"
description: "Approved free Cloudflare sign-in and Analytics Read setup for existing CityBeat account and site. Verify authenticated reporting, protect secrets, preserve Google integration. No subagents or paid deployment approved."
---
## Summary

Approved Cloudflare token is created and securely stored as the CityBeat GitHub Actions secret CLOUDFLARE_ANALYTICS_API_TOKEN. Resolved the approval block after renewed authorization. Fixed the reporting date field rejected by the live API. Prepared for deployment; production still requires the updated query and credential.

## Context

Cloudflare account and site IDs match the collecting CityBeat beacon. Live API rejected datetimeDay_ASC; introspection confirms date_ASC. Existing deployment workflow already injects the GitHub secret only into the server runtime. No new cloud secret resource or recurring charge added.

## Scope

Correct date dimension, UTC calendar reporting boundaries, regression coverage, encrypted deployment secret, and actual-provider verification. No subagents. Deployment spending authorization remains required.

## Risks

Cloudflare reports sampled estimates and only data since beacon installation. The 30-day and 90-day ranges currently have 16 days of data. Never print or commit the token. Production is not connected until deployment. Google Business Profile awaits external API approval.

## Verify Steps

1001 regression tests passed; TypeScript passed; local production build passed; git diff --check passed. Actual fetchCloudflareAnalytics calls succeeded for 7/30/90 days: 5322/13750/13750 views with 7/16/16 trend points and 10 top pages. Credential stored via gh secret stdin, value never logged.

## Rollback Plan

Keep current production revision serving while candidate builds. Promote only after smoke tests; restore prior traffic revision if live checks fail. Revoke named Cloudflare token and remove deployment secret if abandoning integration.

## Notes

Ready for capped one-time Google Cloud deployment approval. Pending local Google Business Profile reporting changes are also already tested but depend on Google API approval for data. No production deployment or paid build triggered in this task.

