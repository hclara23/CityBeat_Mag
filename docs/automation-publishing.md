# Image queue and authorized sports publishing

## Image queue

Admin URL: https://citybeatmag.co/en/admin/social-queue

Requires an admin session and enabled account MFA. All mutations require a same-origin browser request. JPEG/PNG/WebP uploads are normalized to JPEG, EXIF removed, at most 1024 x 1024, and stored under `social-queue/` in the existing media bucket. The image URL is public immediately; upload only publication-ready material with permission and consent.

Set `SOCIAL_IMAGE_QUEUE_ENABLED=true` and runtime `OPENAI_API_KEY`. Existing Facebook credentials must identify official Page `112338362142224`. No key is committed or sent to browsers. Default is disabled.

Upload starts processing synchronously. The existing daily social cron processes one waiting image per invocation and flags interrupted jobs. No additional scheduler subscription is required. Browser disconnection does not delete the saved queue item. Refresh before uploading again.

Writer and reviewer are separate stateless calls to `gpt-4.1-mini-2025-04-14`. Both see the normalized image; reviewer receives the proposed caption, not the writer's conversation. There is one revision maximum, then `needs_review`. AI checks reduce errors, not guarantee correctness. Admin can cancel or correct context and request fresh review; there is no unchecked publish override.

Before any calls, a Firestore transaction reserves **10 cents** from a **500-cent UTC-calendar-month** ledger. Reservations are never refunded, including failures. Maximum 50 attempts/month, four calls/attempt, 600 output tokens/call, <=8,000 UTF-8 text bytes/call and one normalized image/call. Approved pricing: $0.40/M input and $1.60/M output. The conservative reservation exceeds modeled maximum cost with these bounds. This protects this feature only, not other consumers of the same API key. Revisit the cap before any model or pricing change. Intake also has a global 10-images/day limit.

Duplicate normalized images share a SHA-256 queue ID. Transactional state claims prevent simultaneous workers. State is persisted as `publishing` **before** Facebook is called. Timeout, interrupted process or ambiguous provider response becomes `publish_uncertain` and is never automatically retried. Inspect the Page manually. Never reset that state without resolving whether the post exists.

Kill switch: set `SOCIAL_IMAGE_QUEUE_ENABLED=false`. Cancelling a reviewing item prevents its eventual publish; cancellation cannot undo an already-started Facebook request. Existing article publishing is independent.

## Sports

Public URL: https://citybeatmag.co/en/sports
Admin URL: https://citybeatmag.co/en/admin/sports

Shows published CityBeat articles categorized `sports` and authorized contributor updates. No sample stories, invented scores, scraped team photographs or unlicensed feeds are seeded. No AI generation is used for sports facts.

Create a source only after documenting commercial text-publication permission or CityBeat ownership. Set a review/expiry date. Source-specific credentials are shown once, stored only as SHA-256 hashes and can be revoked by disabling the source. Disabled/expired source content is hidden; individual updates can be withdrawn. The API is push-only, so it never fetches arbitrary URLs or article bodies.

An authorized source sends:

```http
POST /api/ingest/sports
Authorization: Bearer SOURCE_TOKEN
X-Sports-Source: SOURCE_ID
Content-Type: application/json
```

```json
{
  "external_id": "unique-source-update-id",
  "title": "An original, verified sports headline",
  "body": "Authorized original reporting with any required attribution included.",
  "author": "Contributor name",
  "published_at": "2026-10-08T18:00:00Z",
  "source_url": "https://publisher.example/original"
}
```

Use a real current timestamp. Payload must be <=16 KB, text <=4,000 characters, date within seven days, at most 20 new updates/source/day. IDs deduplicate retries; duplicates do not overwrite history. A correction is a new update followed by withdrawal of the old item. Source tokens must never appear in URLs.

UTEP permission is unverified. MiLB and USL terms restrict automated commercial collection; their feeds remain unconfigured. An accessible RSS endpoint or attribution is not a reuse license. A permission agreement must cover the fields, attribution, commercial use and automation actually performed. Obtain permission before connecting the provider's sending integration.

## Deployment and verification

Run `npm test`, `npm run lint --workspace @citybeat/web`, `npm run type-check --workspace @citybeat/web` and `npm run build --workspace @citybeat/web`. Tests must not use paid AI or publish to Facebook. Verify public sports and authenticated admin routes after deployment; do not manufacture test posts in production.

Preserve existing Cloud Run environment settings; add only the queue flag/key. `.env` files must be excluded from both source upload and Docker context. Roll back to the previous Cloud Run revision or disable the feature flag if needed. Preserve queue and spending records across rollbacks.

Launching the code does not create source permissions or populate a feed. Until a source is authorized and connected, sports displays an honest empty state and contribution link.
