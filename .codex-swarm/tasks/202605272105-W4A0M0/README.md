---
id: "202605272105-W4A0M0"
title: "Improve login usability and favicon handling"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "frontend", "production"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "6d634be1bdf85a4561029b61fa30f18489910f89", message: "✨ 202605272105-W4A0M0 improve login visibility and favicon handling" }
comments:
  - { author: "ORCHESTRATOR", body: "verified: completed login password visibility, no-store login/profile fetches, and a static favicon asset. | details: Lint, type-check, and production build pass." }
doc_version: 2
doc_updated_at: "2026-05-27T21:19:01+00:00"
doc_updated_by: "agentctl"
description: "Add a password visibility option on the editor login form, prevent /favicon.ico from returning 500, and verify the production login endpoint after the Supabase restore."
---
## Summary
Added a password visibility toggle to the shared login form and added a canonical App Router favicon so browser requests to /favicon.ico no longer hit a failing dynamic path.

## Scope
- Updated packages/ui/components/auth/LoginForm.tsx to let users show or hide the password while signing in.
- Updated apps/web/src/app/[locale]/login/page.tsx to disable browser caching for login and profile requests.
- Added apps/web/src/app/favicon.ico as the Next.js favicon asset.

## Risks
Low. The form change is UI-only and keeps the existing submit flow. The fetch option only prevents cached auth/profile responses. The favicon is a static app asset.

## Verify Steps
- npm run lint --workspace=@citybeat/web
- npm run type-check --workspace=@citybeat/web
- npm run build --workspace=@citybeat/web

## Rollback Plan
Revert commits 6d634be1bdf8 and the favicon relocation commit to remove the login form toggle, no-store fetch options, and favicon asset.

