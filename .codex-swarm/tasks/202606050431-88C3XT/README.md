---
id: "202606050431-88C3XT"
title: "Add platform roles and Stripe Connect foundation"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["backend", "stripe", "roles"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "6335f0b9c615efcbe2590cd3779af4dda8a3d3fa", message: "✨ 88C3XT add platform roles and Stripe Connect foundation" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: adding platform roles, sales revenue schema, and Stripe Connect onboarding foundation." }
  - { author: "ORCHESTRATOR", body: "verified: added platform role, sales revenue, and Stripe Connect foundation | details: production migration still requires CityBeat Supabase access." }
doc_version: 2
doc_updated_at: "2026-06-05T04:46:08+00:00"
doc_updated_by: "agentctl"
description: "Add developer/sales role infrastructure, payout account records, sales/revenue ledger schema, and protected Stripe Connect onboarding APIs."
---
## Summary
Add the first platform foundation for developer/admin/sales roles, Stripe Connect payout onboarding, and revenue/CRM data structures.

## Scope
- Add an additive Supabase migration for platform roles, connected payout accounts, revenue split rules, sales orders, revenue ledger entries, CRM leads, and CRM activities.
- Add shared role helpers for developer, admin, writer, and sales access.
- Add protected platform APIs for role status/grants and Stripe Connect account/onboarding links.
- Add an account-page payout onboarding section that opens Stripe Connect.
- Update key admin and creator access checks so developer access is treated above editor/admin.

## Risks
- Production database migration could not be applied from this workspace because the logged-in Supabase CLI does not have the CityBeat project ref available and no direct database URL/access token is present.
- The Stripe onboarding routes require STRIPE_SECRET_KEY and the new database tables before they can be used successfully in production.
- This phase does not yet create sales checkout sessions, transfers, or the sales CRM dashboard UI.

## Verify Steps
- npm run type-check --workspace=@citybeat/lib
- npm run type-check --workspace=@citybeat/web
- npm run build --workspace=@citybeat/web

## Rollback Plan
- Revert this code commit to remove the new APIs and payout UI.
- If the SQL migration has been applied, disable access by setting sales_dashboard_enabled/is_sales/is_developer false as needed; destructive table rollback should only happen after exporting revenue/CRM data.

