---
id: "202610310754-Y3EHBA"
title: "Deploy verified hyperlocal directory improvements"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610310728-08DNQA"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: deploy the tested directory release with Docling excluded from source upload and container context, and a thirty-minute CI timeout under the approved one-time budget." }
  - { author: "ORCHESTRATOR", body: "start: protect approved import review notes and reviewer identities from public serializers | details: cancel the first CI run before Cloud Build while completing the newly approved production improvements." }
doc_version: 2
doc_updated_at: "2026-10-31T08:47:50+00:00"
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

Return 100 percent traffic to citybeat-web-00463-sup if post-deployment checks fail. No schema migration or production data rewrite is part of this release.

## Notes

Combined release includes RH8JEB tools and local-quality improvements. Previous ac62a74 deploy run cancelled before cloud build; rollback remains citybeat-web-00463-sup. Final candidate gate now tests new anonymous mutation denials and locale/campaign-safe QR redirects. Local build, 1,037 tests, emulator imports and browser checks pass. Upload list excludes Docling/HyperFrames runtimes and rendered media. No paid service or recurring hosting added.

