---
id: "202607302139-85BZPC"
title: "Document directory platform implementation handoff"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["docs", "handoff", "directory"]
verify: ["rg -q Claude docs/CLAUDE_HANDOFF_DIRECTORY_PLATFORM.md"]
commit: { hash: "213ee28ab0ad34c6c8aa59896caeb17c9988e581", message: "📝 202607302139-85BZPC document Claude directory platform handoff" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Build a complete implementation handoff so another coding agent can continue without conversation history." }
  - { author: "ORCHESTRATOR", body: "verified: The handoff contains all six implementation packages, critical code paths, security constraints, rollout sequencing, test coverage, deployment guidance, and completion criteria | details: all referenced critical files exist." }
doc_version: 2
doc_updated_at: "2026-07-30T21:43:58+00:00"
doc_updated_by: "agentctl"
description: "Create a self-contained Claude handoff covering the six requested directory platform implementations plus newsletter consent, developer-only audience management, security, analytics, rollout, testing, and deployment guidance."
---
## Summary

Create a self-contained Claude handoff for the planned directory owner platform, analytics, notifications, newsletter consent, and developer-only audience console work.

## Context

The user requested a handoff because the current conversation is nearing its token limit. The document must preserve completed production baseline work, the six outstanding implementation packages, recommended architecture, security constraints, tests, and deployment steps.

## Scope

Add docs/CLAUDE_HANDOFF_DIRECTORY_PLATFORM.md covering salesperson verification bypass; owner CMS and entitlements; Google Business Profile parity and CityBeat differentiators; listing analytics; owner notifications and monthly reports; newsletter preferences and developer-only downloadable audience data.

## Risks

The handoff must not blur completed and pending work, weaken payment or claim security, imply disabled UI is authorization, or recommend marketing behavior without jurisdiction-aware consent and suppression safeguards.

## Verify Steps

Confirm the Markdown file exists; verify all six implementation headings, existing code map, rollout order, tests, deployment notes, and definition of done are present; inspect repository status and commit only the handoff/task artifacts.

## Rollback Plan

Revert the documentation commit. No runtime code, configuration, production data, or deployment state is changed by this task.

## Notes

Implementation remains pending for the next agent. Starting production baseline is main commit 240fa6a3e359fc414e31928e9adc9cb1b2a1b3e4 and Cloud Run revision citybeat-web-00156-dkf.

