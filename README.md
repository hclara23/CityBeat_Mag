# CityBeat Mag

Hyper-local bilingual publication and directory platform.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database/Auth**: Firebase Firestore & Firebase Authentication
- **Content Management**: Sanity Studio (with Live Preview)
- **Styling**: Tailwind CSS + Glassmorphism + Framer Motion
- **Payments**: Stripe Checkout (via Next.js Serverless Webhooks)
- **Hosting**: Google Cloud Run & Firebase Storage

## Deployment Guide

### 1. Firebase (Database, Auth, & Storage)
Initialize your Firebase project and ensure you have enabled **Firestore Database**, **Authentication**, and **Storage**.
Generate a Service Account key from the Firebase console. Firestore is the system of record for content, directory, payments, and analytics.

### 2. Google Cloud Run (Frontend & APIs)
The application uses Docker to build a standalone Next.js image. You must deploy the resulting container to Google Cloud Run.

Ensure you have the `gcloud` CLI installed and authenticated.

**You do not deploy by hand.** Push to `main` and
`.github/workflows/deploy-web.yml` builds, deploys as an untrafficked candidate,
smoke-tests it, promotes it and rolls back automatically if the promotion fails.
A hand deploy skips every one of those steps.

If you must (the pipeline itself is broken), copy the flags the workflow uses —
in particular `--update-env-vars`:

```bash
gcloud run deploy citybeat-web \
  --source . \
  --region us-central1 \
  --project kerstenblueprint \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=kerstenblueprint"
```

> **Never `--set-env-vars` on this service.** It REPLACES the entire
> environment, so a command naming one variable deletes every other one —
> `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`
> and the rest — leaving a site that serves pages, cannot take a payment, and
> fails every scheduled job. `--update-env-vars` sets the named variable and
> leaves the others alone. This block previously used `--set-env-vars` against
> the service name `citybeat-mag-web`, which does not exist: it was harmless
> only because it created a separate unused service, and would have become
> destructive the moment someone corrected the name.

> Note: Ensure your Stripe and Firebase Admin secrets are securely stored in Google Cloud Secret Manager.

### 3. Automated Testing
We use Cypress for end-to-end testing. To run tests locally:
```bash
npm run dev
npx cypress open
```
