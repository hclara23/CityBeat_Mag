---
id: "202610082148-JRZJR5"
title: "Audit production health and recover leads"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-08T21:48:44+00:00"
doc_updated_by: "agentctl"
description: "Determine current CityBeat app health, identify the source of failure/error notifications, trace lead capture end-to-end, and report actionable leads and remediation priorities without modifying production data."
---
## Summary

Audit production health, investigate failure notifications, and trace lead capture without mutating production data.

## Context

The owner reports receiving many failed/error emails and needs the current application status plus visibility into captured leads.

## Scope

Inspect repository configuration, recent deployment and runtime evidence, public endpoints, notification sources, and lead storage/delivery paths. Produce a severity-ranked report and lead follow-up list. No production writes or purchases.

## Risks

Diagnostics may encounter unavailable credentials, third-party service access limits, or sensitive lead data. Avoid exposing secrets or personal data and perform only read-only external checks.

## Verify Steps

Confirm repository and deployment configuration; run safe local checks; verify public endpoints; inspect available read-only runtime evidence; trace each lead intake destination; reconcile recent lead records and delivery failures.

## Rollback Plan

This is a read-only audit. Rollback is limited to reverting the task-planning commit if requested; no production state will be changed.

## Notes

User approved the four-step audit plan on 2026-10-08.

