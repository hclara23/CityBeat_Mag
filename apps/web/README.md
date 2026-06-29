# CityBeat — Web App (`apps/web`)

The main public site for [citybeatmag.co](https://citybeatmag.co): bilingual (EN/ES)
local news, the business directory, events, deals, advertising, admin, and the
sales tooling — all in one Next.js app.

## Stack
- **Framework**: Next.js 14 (App Router) + `next-intl` for `/en` · `/es` routing
- **Database / Auth / Storage**: Firebase (Firestore + Auth session cookie + Storage)
- **Payments**: Stripe (Checkout, subscriptions, Connect payouts) via the webhook at `/api/stripe/webhook`
- **CMS**: Sanity (published content) · **Email**: Resend/SMTP · **Translation**: DeepL
- **Styling**: Tailwind CSS

## Requirements
- Node.js 20+
- npm (workspaces; run from the repo root)

## Development
```bash
# from the repo root
npm install
npm run dev          # web app on http://localhost:3000
npm run type-check
npm run lint
```
Create `apps/web/.env.local` from `apps/web/.env.example` (Firebase, Stripe, Sanity, …).

## Routing
- Locale-scoped public routes: `/en/...` and `/es/...` (root `/` → `/en`)
- Key sections: `/stories`, `/directory`, `/best/[category]/[city]`, `/events`,
  `/deals`, `/jobs`, `/ads`; admin under `/admin`, sales under `/admin/sales`.

## Deployment (Git → Cloud Run)
Production runs on **Google Cloud Run** (`citybeat-web` in GCP project
`kerstenblueprint`), fronted by Firebase Hosting → `citybeatmag.co`. NOT Vercel.

Push to `main` touching `apps/web/**`, `packages/**`, or `Dockerfile` runs
`.github/workflows/deploy-web.yml`, which builds the container and deploys to
Cloud Run. Runtime secrets persist on the Cloud Run service across deploys.

See the repo-root `CLAUDE.md` for the full architecture, env vars, and cron/automation setup.
