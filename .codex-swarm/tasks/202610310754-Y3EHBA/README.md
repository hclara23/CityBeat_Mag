---
id: "202610310754-Y3EHBA"
title: "Deploy verified hyperlocal directory improvements"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610310728-08DNQA"]
tags: []
commit: { hash: "c7942dee81e66e3a67ad4a279b8406db8fe996e5", message: "🚧 Y3EHBA start: protect approved import review notes and reviewer identities from public serializers | details: cancel the first CI run before Cloud Build while completing the newly approved production improvements." }
comments:
  - { author: "ORCHESTRATOR", body: "start: deploy the tested directory release with Docling excluded from source upload and container context, and a thirty-minute CI timeout under the approved one-time budget." }
  - { author: "ORCHESTRATOR", body: "start: protect approved import review notes and reviewer identities from public serializers | details: cancel the first CI run before Cloud Build while completing the newly approved production improvements." }
  - { author: "ORCHESTRATOR", body: "verified: deployed combined source ef8c6be as citybeat-web-00467-zuj with 100 percent traffic | details: CI, 1,038 local tests, local build, authenticated UI and 37 public checks pass. QR redirects and local eligibility verified, scheduler matches, no new recurring infrastructure." }
doc_version: 2
doc_updated_at: "2026-10-31T09:15:47+00:00"
doc_updated_by: "agentctl"
description: "Deploy the approved directory release within a one-time USD 1 cap, exclude the local Docling pilot, retain current monthly infrastructure, and verify candidate and live behavior. No subagents. Related implementation: 202610310728-08DNQA and 202610310716-BECXY5."
---
## Summary

Deploy the approved directory improvements with candidate and live verification.

## Context

User approved deployment up to USD 1 one-time, no new monthly costs, Docling local only and no subagents. Implementation commits 652df72, 926048b and b4cd3cf are locally tested.

## Scope

Existing Cloud Run service only. Exclude scripts/docling-pilot from build upload and Docker context. Bound CI to thirty minutes. Preserve service sizing, secrets, jobs and existing records.

## Risks

No bulk data import or publication is run during verification. Current rollback revision: citybeat-web-00463-sup. A new build may fail before promotion; do not bypass test gates. Invoice totals lag; track build duration and published unit price rather than claiming a finalized bill.

## Verify Steps

Validate upload exclusions and workflow YAML; use the existing CI type, security and test gates; confirm candidate smoke tests and live traffic revision; verify EN/ES directory search, hidden-draft safeguards and authenticated staff/owner UI where available.

## Rollback Plan

For the final postal-format correction return 100 percent traffic to citybeat-web-00465-rat. The pre-release baseline is citybeat-web-00463-sup. No billing migration, production import or owner-content rewrite occurred; retain the two genuine local promotion drafts.

## Notes

DONE: final deployed source ef8c6be, workflow 41187047530 success, citybeat-web-00467-zuj serves 100 percent. Earlier combined release run 41186157345 also succeeded. Local 1,038 tests/build pass; 37 live public checks plus new QR/auth/SEO/privacy checks pass. Authenticated production support, prefill, advertiser reporting, source selection and draft persistence verified. Direct scheduler check: 22 declared/live jobs, no drift, deliberate ingest pause retained. CI scheduler reader lacks list permission; no IAM expansion made. Two Cloud Builds total 10.787 minutes, estimated compute USD 0.0647 at USD 0.006/min; final invoice/CI/storage excluded. Previous cancelled run never built. Docling/HyperFrames excluded from uploads and containers. No new services or schedules. RH8JEB remains blocked only on external Postiz account/channel connection.

