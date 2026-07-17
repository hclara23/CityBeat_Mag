# CityBeat Crawler (Crawl4AI)

A tiny FastAPI wrapper around [Crawl4AI](https://github.com/unclecode/crawl4ai)
that turns any URL into clean, LLM-ready markdown. Runs headless Chromium via
Playwright. It's a **separate service** (Python) — deployed on its own Cloud Run
instance (scale-to-zero, so ≈ free when idle). The CityBeat web app calls it via
`apps/web/src/lib/crawler.ts`.

## What it's for
- **Directory enrichment** — scrape a claimed business's website for hours, menu,
  description, and photos (feed the `enrich-contacts` cron).
- **Fuller newsroom source text** — get the full article body from a source URL,
  richer than the RSS `content:encoded` excerpt, before Claude re-reports it.

## Deploy (Cloud Run)
From `services/crawler`:

```bash
gcloud run deploy citybeat-crawler \
  --source . \
  --project kerstenblueprint \
  --region us-central1 \
  --memory 2Gi --cpu 2 --timeout 120 \
  --allow-unauthenticated \
  --set-env-vars "CRAWLER_SECRET=<generate-a-long-random-string>"
```

Then point the web app at it — set these on the **citybeat-web** Cloud Run service:

```
CRAWLER_URL    = https://citybeat-crawler-<hash>-uc.a.run.app
CRAWLER_SECRET = <same string as above>
```

Notes:
- The service is public but **gated by the `CRAWLER_SECRET` header** (the web app
  sends `x-crawler-secret`). Use a long random secret — it prevents it being used
  as an open SSRF proxy.
- `--memory 2Gi` — Chromium OOMs on 512Mi.
- The first build is slow (Playwright downloads a browser); it scales to zero after.

## API
- `GET /health` → `{ "ok": true }`
- `POST /crawl` — header `x-crawler-secret: <CRAWLER_SECRET>`, body `{ "url": "https://…" }`
  → `{ url, success, status_code, title, markdown }`
