---
id: "202602070124-P1JYRV"
title: " Security and compliance review^"
status: "DOING"
priority: "high"
owner: "REVIEWER"
depends_on: ["^[]^"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start:_Security_review_fixes_demo_auth_fallback_and_ad_purchases_RLS." }
  - { author: "ORCHESTRATOR", body: "Implemented cookie-based auth in ads API, disabled demo fallback in prod, and removed public ad_purchases insert policy (requires DB migration). Tests not run." }
doc_version: 2
doc_updated_at: "2026-02-07T01:24:03+00:00"
doc_updated_by: "agentctl"
description: "^Role: Security Compliance Reviewer. Scan for secrets auth gaps unsafe storage missing rules CORS and token handling issues. Produce severity rated findings and fixes.^"
---
