---
id: "202610090010-3983ZF"
title: "Concordia legal documents"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:25:11+00:00"
doc_updated_by: "agentctl"
description: "Audit and update legal documents for the publicly reachable Concordia Heritage Association application in C:\\dev\\Concordia Heritage Association."
---
## Summary

Added public privacy, cookie, and terms routes for Concordia Heritage Association.

## Scope

Covered member accounts and sessions, association records, meeting audio, Cloud services, telemetry, optional Anthropic minutes drafting, donations and memberships, archives, and authorized portal use.

## Risks

Nonprofit, archival, donation, and cemetery-record obligations should be reviewed by qualified counsel. Full database-backed tests require the local PostgreSQL test service.

## Verify Steps

npm run check passed; direct GET checks for /privacy, /cookies, and /terms returned 200. Full npm test was blocked by ECONNREFUSED on local PostgreSQL port 55433; 13 database-independent tests passed before cancellation.

## Rollback Plan

Revert Concordia commit e640e93.

## Notes

External repository commit: e640e93.

