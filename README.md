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
Generate a Service Account key from the Firebase console. Note: We have fully migrated off Supabase!

### 2. Google Cloud Run (Frontend & APIs)
The application uses Docker to build a standalone Next.js image. You must deploy the resulting container to Google Cloud Run.

Ensure you have the `gcloud` CLI installed and authenticated.

```bash
# 1. Build and push the Docker image to Google Artifact Registry
gcloud builds submit --tag gcr.io/[PROJECT-ID]/citybeat-mag

# 2. Deploy to Cloud Run
gcloud run deploy citybeat-mag \
  --image gcr.io/[PROJECT-ID]/citybeat-mag \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=[PROJECT-ID]" \
  --set-secrets="FIREBASE_SERVICE_ACCOUNT_KEY=firebase-admin-key:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest"
```

> Note: Ensure your Stripe and Firebase Admin secrets are securely stored in Google Cloud Secret Manager.

### 3. Automated Testing
We use Cypress for end-to-end testing. To run tests locally:
```bash
npm run dev
npx cypress open
```
