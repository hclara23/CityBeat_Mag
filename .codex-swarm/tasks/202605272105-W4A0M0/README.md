---
id: "202605272105-W4A0M0"
title: "Improve login usability and favicon handling"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["auth", "frontend", "production"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
doc_version: 2
doc_updated_at: "2026-05-27T21:05:03+00:00"
doc_updated_by: "agentctl"
description: "Add a password visibility option on the editor login form, prevent /favicon.ico from returning 500, and verify the production login endpoint after the Supabase restore."
---
