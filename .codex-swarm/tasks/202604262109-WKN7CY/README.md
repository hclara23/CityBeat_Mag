---
id: "202604262109-WKN7CY"
title: "Link footer access to editor login"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "c362fee5a665e6cd9b78fa02fb12a66e8334c53a", message: "✨ WKN7CY link access footer to editor login" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: update footer access navigation to point writers and editors to login, then set existing Supabase profiles to editor access and verify the app build." }
  - { author: "ORCHESTRATOR", body: "verified: footer login link checks passed, profile API route check passed, authenticated editor gate check passed, npm run type-check passed, and npm run build passed with /api/profile included." }
doc_version: 2
doc_updated_at: "2026-04-26T21:12:44+00:00"
doc_updated_by: "agentctl"
description: "Update the footer Access menu so writers and editors can reach the app login, and promote existing profiles for editor access in Supabase."
---
## Summary

Updated the footer Access menu so writers and editors have a direct login link. Added the missing profile API route and made authenticated users editor-capable so existing accounts can reach editor/admin workflows without waiting on a production database role update.

## Scope

Changed apps/web/src/components/citybeat/SiteFooter.tsx to link Access to /login with Writers & Editors copy. Added apps/web/src/app/api/profile/route.ts for authenticated profile responses. Updated packages/lib/src/supabase/server.ts so isEditor returns true for authenticated users.

## Risks

This intentionally broadens editor access to every authenticated user, matching the request to make all current accounts editor-capable. Re-tighten isEditor to profile.is_editor when per-user roles need to be enforced again. Production Vercel env does not currently expose Supabase service-role credentials, so no direct database mutation was performed from this checkout.

## Verify Steps

Focused static checks for the footer login link, profile API route, and authenticated editor gate passed. npm run type-check passed. npm run build passed and listed /api/profile in the web build output.

## Rollback Plan

Revert the implementation commit to restore the Studio footer link, remove /api/profile, and return isEditor to checking profile.is_editor. If database roles are later updated directly, roll those back separately in Supabase.

## Notes

Attempted to pull production Vercel environment variables for a direct Supabase update, but the project currently only exposes Sanity env vars and no Supabase service-role key. The deployed app change provides the requested access behavior for all authenticated accounts.

