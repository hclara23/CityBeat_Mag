---
id: "202606050523-2Y99QW"
title: "Hide developer account from admins"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["backend", "roles", "supabase"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "af4d772a217fa49556c0941fa64bdee4d30906d4", message: "🛡️ 202606050523-2Y99QW hide developer account from admins" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Correct production owner/admin roles and add Supabase/API guards so admins cannot discover developer accounts." }
  - { author: "ORCHESTRATOR", body: "verified: production role setup confirmed, Supabase migration applied, migration list matched, and lib/web type-check plus web production build passed." }
doc_version: 2
doc_updated_at: "2026-06-05T05:36:01+00:00"
doc_updated_by: "agentctl"
description: "Set production owner/admin roles and add policy/API guards so admins cannot discover developer accounts."
---
## Summary

Set production owner/admin account roles and hide developer-owned records from non-developer admins.

## Scope

Created and confirmed morningstarelp@gmail.com as the developer owner account, set citybeat@yahoo.com as admin/editor/writer, demoted citybeatmag@yahoo.com from developer, added Supabase RLS policies that hide developer profiles, roles, connected accounts, and developer ledger rows from admins, and added an API guard for role-management PATCH requests.

## Risks

Admins no longer see developer profile or payout account rows, so any admin UI that expects all profile rows must tolerate filtered results. Developer users retain full access through RLS and the role API.

## Verify Steps

npm run type-check --workspace=@citybeat/lib; npm run type-check --workspace=@citybeat/web; npm run build --workspace=@citybeat/web; supabase db push --dry-run; supabase db push --yes; supabase migration list; production role summary query via Supabase service key.

## Rollback Plan

Revert the API guard commit and apply a follow-up Supabase migration that restores the previous broad admin policies for profiles, profile_roles, stripe_connected_accounts, and revenue_ledger if admin visibility must be restored.

## Notes

Passwords and service-role secrets were used only for production account setup and were not committed.

