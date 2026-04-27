---
id: "202604270330-B235A3"
title: "Add admin dashboard navigation"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["admin", "ui", "auth"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: admin user lands on /admin, but the dashboard lacks direct navigation to creator/editor surfaces." }
doc_version: 2
doc_updated_at: "2026-04-27T03:32:24+00:00"
doc_updated_by: "agentctl"
description: "Make the admin dashboard the operational landing page for the main editor account and expose links to creator studio, article creation, review queue, account, billing, advertising, and public pages."
---
## Summary

Add role-aware admin dashboard navigation so the main editor can reach creator studio, new article, review queue, account, billing, ads, and public pages from /admin.

## Scope

In scope: the admin dashboard page UI and links to existing routes. Out of scope: creating new dashboard pages, changing database schema, or replacing the CMS/editor workflow.

## Risks

Low risk. This is a UI navigation change on an already authenticated admin page and does not alter access control.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert the admin dashboard navigation additions in apps/web/src/app/[locale]/admin/page.tsx.

