<#
.SYNOPSIS
  Deploy the CityBeat web app to Cloud Run (the REAL production target).

.DESCRIPTION
  citybeatmag.co is served by the Cloud Run service `citybeat-web` in the
  Firebase/GCP project `kerstenblueprint` (region us-central1) -- NOT Vercel.
  The .github/workflows/deploy-web.yml Vercel pipeline is orphaned and does not
  update the live site.

  This performs a source-based build+deploy via Cloud Build using the root
  Dockerfile. Source deploys always rebuild from this repo, so they produce the
  correct web image and overwrite any bad/`:latest` tag. Existing runtime env
  vars on the service (STRIPE_SECRET_KEY, NEXT_PUBLIC_FIREBASE_*, etc.) are
  preserved across deploys unless explicitly changed.

.NOTES
  Requires: gcloud CLI authenticated with deploy permissions on kerstenblueprint.
  Public NEXT_PUBLIC_FIREBASE_* values are baked at build time by the root Dockerfile.
#>
param(
  [string]$Project = "kerstenblueprint",
  [string]$Region  = "us-central1",
  [string]$Service = "citybeat-web"
)

$ErrorActionPreference = "Stop"
Write-Host "Deploying $Service to Cloud Run ($Project / $Region) from source..." -ForegroundColor Cyan

gcloud run deploy $Service `
  --source . `
  --project $Project `
  --region $Region `
  --quiet

Write-Host "Done. Verify: curl -s -o /dev/null -w '%{http_code}' -X POST https://citybeatmag.co/api/auth/login -H 'Content-Type: application/json' --data '{}'" -ForegroundColor Green
