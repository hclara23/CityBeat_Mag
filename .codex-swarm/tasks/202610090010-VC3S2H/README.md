---
id: "202610090010-VC3S2H"
title: "El Paso Tax Watch legal documents"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:24:57+00:00"
doc_updated_by: "agentctl"
description: "Audit and update legal documents for the publicly reachable El Paso Tax Watch application in C:\\dev\\ElPasoTaxWatch.com."
---
## Summary

Added public privacy, cookie, and terms routes to El Paso Tax Watch.

## Scope

Disclosed subscriber data, local unsubscribe storage, active GA4 analytics, correspondence, public records, source limitations, and informational-use disclaimers.

## Risks

Public-record and tax analysis is informational; qualified counsel should review the final policy posture.

## Verify Steps

npm run typecheck; npm test; npm run build — all passed in C:\dev\ElPasoTaxWatch.com.

## Rollback Plan

Revert El Paso Tax Watch commit db7eba9.

## Notes

External repository commit: db7eba9.

