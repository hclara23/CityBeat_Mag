---
id: "202610090112-8HREVB"
title: "Extend published app legal audit"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610082359-WKDD0X"]
tags: ["legal", "compliance"]
comments:
  - { author: "ORCHESTRATOR", body: "Approved by user. CityBeat .co is canonical; Elevate and Builders legal updates are in scope; deployment is excluded." }
doc_version: 2
doc_updated_at: "2026-10-09T01:12:54+00:00"
doc_updated_by: "agentctl"
description: "Verify CityBeat uses citybeatmag.co, audit Elevate El Paso and Builders of the Desert against their actual production data flows, update legal documents and incorrect CityBeat links, validate and commit all local changes, and do not deploy."
---
## Summary

Extend the completed published-app legal audit to Elevate El Paso and Builders of the Desert, while verifying that CityBeat uses its actual citybeatmag.co domain.

## Scope

Audit existing privacy and terms disclosures against implemented data flows; add or revise legal pages as needed; correct Elevate's stale CityBeat portfolio link; validate and commit local changes. No deployment, purchases, or production mutation.

## Risks

Legal text must describe observed behavior without promising unsupported retention periods, regulatory status, or rights. Both target repositories contain unrelated user changes that must be preserved.

## Verify Steps

Confirm public canonical domains; search for stale citybeatmag.com references; run targeted type checks, lint, and tests in each changed repository; inspect diffs and repository status before committing.

## Rollback Plan

Revert only the dedicated legal-audit commits in the affected repositories. No production rollback is required because deployment is outside scope.

