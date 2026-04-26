---
id: "202604262210-KG9AEJ"
title: "Restore Supabase-backed editor roles"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: pull configured Supabase environment variables, restore role checks to production profile flags, update existing profiles through the service role, verify, push, and deploy." }
doc_version: 2
doc_updated_at: "2026-04-26T22:13:04+00:00"
doc_updated_by: "agentctl"
description: "Use real Supabase profile role flags for writer/editor access now that production Supabase env vars are configured, and seed existing profiles with editor/writer access."
---
## Summary

Restored production role enforcement so editor/admin access is controlled by Supabase profile flags instead of a blanket authenticated-user shortcut. Confirmed Supabase env var names are configured in Vercel, but sensitive values are not pullable locally.

## Scope

Updated packages/lib/src/supabase/server.ts so isEditor reads profile.is_editor again. Updated apps/web/src/app/api/profile/route.ts so it returns real is_editor and is_writer profile flags. Pulled production env metadata from Vercel to confirm the Supabase variable names exist.

## Risks

Existing users still need profiles.is_editor and profiles.is_writer set true in Supabase. Vercel sensitive env values pull as empty placeholders locally, so the service-role database update could not be executed from this checkout without exposing the secret locally.

## Verify Steps

Focused role checks failed before the fix and passed after the fix. npm run type-check passed. npm run build passed and included /api/profile in the Next.js output.

## Rollback Plan

Revert the implementation commit to return to blanket authenticated editor access. No database changes were made from this checkout; if profile roles are changed in Supabase, reverse them with SQL updates.

## Notes

Run this in Supabase SQL Editor after applying schema: update profiles set is_editor = true, is_writer = true; If is_writer does not exist in the selected schema, add the column or update only is_editor.

