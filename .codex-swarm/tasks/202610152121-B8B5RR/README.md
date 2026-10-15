---
id: "202610152121-B8B5RR"
title: "Protect merged directory records from bulk publication"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["code", "backend", "directory"]
verify: ["npm test"]
commit: { hash: "d3befc2a83e28a759d4c7508a348154eb63655ae", message: "🔒 B8B5RR audit bulk publication and block merged or restricted listings" }
comments:
  - { author: "CODER", body: "Start: replace unsafe publish-all with audited eligibility rules; protect merge chains and restricted provenance; add deterministic tests and an admin preview." }
  - { author: "CODER", body: "verified: merged and restricted listings fail closed, eligible publication is confirmation-gated and capped, 649 repository tests passed, and web type-check passed." }
doc_version: 2
doc_updated_at: "2026-10-15T21:23:20+00:00"
doc_updated_by: "agentctl"
description: "Replace unsafe publish-all behavior with validation that refuses merged duplicates, malformed records, disallowed provenance, and unresolved canonical chains; add an audit preview and tests."
---
## Summary

Replaced unsafe publish-all behavior with an audited, bounded publication workflow that publishes only eligible canonical records.

## Context

Production contains 1,728 hidden records, all merged siblings. Their merge chains contain no missing targets or cycles and resolve to 884 published canonical roots, so the correct safe publication count is zero.

## Scope

Pure publication eligibility audit, merge and provenance safeguards, exact-identity deduplication, closed/thin record validation, a GET preview, a confirmation-gated 250-record POST batch, and safer admin UI copy.

## Risks

A false positive could publish a duplicate or restricted-source page. The implementation fails closed, preserves hidden records, requires explicit confirmation, and caps each batch at 250.

## Verify Steps

Focused publication tests pass 5 of 5; full repository tests pass 649 total; web type-check passes; git diff check passes. Production data audit remains read-only until deployment.

## Rollback Plan

Revert the implementation commit and redeploy. No production records were changed during implementation; any future batch can be identified by publication_method validated_bulk and published_at.

## Notes

The legacy route path remains stable for the admin UI, but its semantics are now audit-first and eligibility-only.

