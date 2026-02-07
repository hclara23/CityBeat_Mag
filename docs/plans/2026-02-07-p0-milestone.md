# P0 Milestone Implementation Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Stabilize build and CI, secure ads checkout and auth, and close critical data gaps for a deployable milestone.

Architecture: Monorepo with Next.js apps (web + ads), Cloudflare Worker for automation and webhooks, Supabase for data and auth, Stripe for billing, Sanity for content. Focus on server-side pricing, auth boundaries, and RLS hardening while unblocking lint, type-check, and build.

Tech Stack: Next.js 14, React 18, TypeScript 5, Supabase, Stripe, Sanity, Cloudflare Workers, Turbo, Tailwind.

---

### Task 1: Build and CI Fixes (UI lint + type-check)

Files:
- Modify: packages/ui/package.json
- Modify: packages/ui/components/auth/SignupForm.tsx
- Create: packages/ui/.eslintrc.cjs (or packages/ui/eslint.config.js)

Step 1: Write the failing test
- Not applicable (no existing test harness for packages/ui).

Step 2: Reproduce the failures
- Run: npm run lint
- Expected: @citybeat/ui fails with ESLint No files matching the pattern dot were found.
- Run: npm run type-check
- Expected: @citybeat/ui fails with TS error in SignupForm.tsx (fieldErrors assignment).

Step 3: Minimal implementation to fix lint
- Add a minimal ESLint config in packages/ui that targets TS/TSX files.
- If ESLint is intentionally unused here, adjust packages/ui/package.json lint script to avoid false failures.

Step 4: Minimal implementation to fix type-check
- Update SignupForm.tsx to avoid assigning undefined to Record<string, string>.
- Example: remove keys when clearing errors, or change type to Record<string, string | undefined> and align usage.

Step 5: Verify
- Run: npm run lint
- Run: npm run type-check
- Expected: both pass.

Step 6: Commit
- Stage only the three files above.
- Commit via agentctl with task ID 0DSNW2.

---

### Task 2: Secure Ads Checkout Pricing

Files:
- Modify: apps/ads/src/app/api/checkout/route.ts
- Modify: apps/ads/src/app/[locale]/newsletter/page.tsx
- Modify: apps/ads/src/app/[locale]/sponsored/page.tsx
- Modify: apps/ads/src/app/[locale]/banners/page.tsx
- Create or Modify: apps/ads/src/lib/pricing.ts

Step 1: Write the failing test
- Not applicable (no existing test harness for ads API).

Step 2: Implement server-side pricing
- Move pricing constants into apps/ads/src/lib/pricing.ts.
- Accept adType + billingCycle from client; compute price server-side.
- Reject mismatched or unsupported billing cycles.

Step 3: Update UI to use shared pricing
- Import pricing constants in ad creation pages.
- Remove client-sent price for server validation (only send adType + billingCycle).

Step 4: Verify
- Manual: create a campaign in UI and ensure checkout succeeds.
- Manual: try to send a bogus amount and confirm server rejects.

Step 5: Commit
- Stage only touched files.
- Commit via agentctl with task ID ZBF126.

---

### Task 3: Ads Auth Hardening

Files:
- Modify: apps/ads/src/lib/supabase.ts
- Modify: apps/ads/src/app/api/session/route.ts
- Modify: apps/ads/src/app/api/customer-portal/route.ts

Step 1: Enforce auth in production
- Ensure ADS_DEMO_USER_ID is ignored when ADS_REQUIRE_AUTH=true or NODE_ENV=production.

Step 2: Secure session endpoint
- Require auth for /api/session and verify the requester owns the session or campaign.

Step 3: Restrict returnUrl
- Allowlist return URLs to ads.citybeatmag.co (and localhost for dev).

Step 4: Verify
- Manual: unauthenticated requests return 401.
- Manual: customer portal rejects non-allowlisted returnUrl.

Step 5: Commit
- Commit via agentctl with task ID ZBF126 (or a new task if split).

---

### Task 4: Supabase RLS Hardening

Files:
- Modify: infra/sql/01_initial_schema.sql

Step 1: Remove public insert policy
- Replace WITH CHECK (true) with a service role-only or authenticated check as appropriate.

Step 2: Verify
- Confirm service role writes still work (webhook uses service role and bypasses RLS).

Step 3: Commit
- Commit via agentctl with task ID ZBF126 (or new security task if split).

---

### Task 5: Tracking + Analytics

Files:
- Modify: services/worker/src/handlers/tracking.ts
- Modify: apps/web/src/app/api/analytics/route.ts

Step 1: Implement tracking writes
- Insert tracking events into Supabase analytics (or impressions/clicks) tables.

Step 2: Replace mock analytics
- Query Supabase for real metrics in web analytics endpoint.

Step 3: Verify
- POST to /api/tracking and confirm DB write.
- GET /api/analytics returns real data.

Step 4: Commit
- Commit via agentctl with task ID ZBF126 (or new task if split).

---

### Task 6: UI Wiring for Campaign Actions

Files:
- Modify: apps/ads/src/app/[locale]/campaigns/page.tsx

Step 1: Wire Pause/Resume
- Add click handlers calling /api/campaigns/:id/pause and /api/campaigns/:id/resume.
- Update local state after success.

Step 2: Verify
- Manual: pause/resume changes status and UI.

Step 3: Commit
- Commit via agentctl with task ID ZBF126.

---

### Final Verification
- npm run lint
- npm run type-check
- npm run build
- Manual smoke tests (ads create -> checkout -> orders; web briefs fetch; worker health)

---

Execution Handoff
Plan complete and saved to docs/plans/2026-02-07-p0-milestone.md. Two execution options:
1. Subagent-Driven (this session) - I simulate one role at a time, review between tasks, fast iteration
2. Parallel Session (separate) - You open a new session with executing-plans for batch execution

Which approach?
