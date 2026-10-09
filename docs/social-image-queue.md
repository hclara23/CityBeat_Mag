# Social image queue

Admins with two-factor authentication use `/en/admin/social-queue` (also available under `/es`).

## Workflow

1. Drop/select up to 100 JPEG, PNG or WebP graphics under 8 MB each. Optional factual notes and CityBeat story link apply to the whole batch; use separate batches for different stories.
2. Confirm publication rights. Keep the browser open until all files are saved. Individual failures remain selected for retry; duplicates are skipped by normalized-image hash.
3. Close the browser once uploads finish. The existing scheduler checks every ten minutes. Each run prepares one item using a caption writer and separate stateless image reviewer. Rejection gets one rewrite, then a human-review hold.
4. Approved items wait for their assigned 6 AM, noon or 6 PM America/Denver slot. Slots include daylight saving. Assignment is transactional, one image per slot, with at least 30 minutes lead time.
5. Review the dashboard for captions, links, dates, rejection reasons, uncertain delivery, and Facebook post links. Edit/move-slot triggers fresh independent review. Pause/cancel works until publication is claimed. Global pause cannot recall an in-flight Facebook request.

Only the official Page ID `112338362142224` is allowed. No image upload or manual retry calls Facebook. A due-time transaction is required before publication. Posts missed by 30 minutes are held instead of catch-up posted. An uncertain Facebook response is never automatically retried. Manually inspect the official Page first.

## Budget and operating limits

- Existing OpenAI key and `gpt-4.1-mini-2025-04-14`, explicitly standard service tier.
- USD 5.00 reserved ceiling per UTC month, shared transactionally across workers. Four cents reserved, never refunded, for each preparation/retry: up to four calls, 8000 text bytes plus at most a 1024px image and 600 output tokens per call. Supports up to 125 preparations per month before older reservations are considered.
- Standard model pricing verified October 8, 2026: $0.40/M input, $1.60/M output. 1024-square image: 1024 patches x 1.62 = 1659 image tokens. Four-cent reservation remains above the conservative worst case including schema overhead. See https://developers.openai.com/api/docs/models/gpt-4.1-mini and https://developers.openai.com/api/docs/guides/images-vision . Re-evaluate if pricing/model changes.
- 100 uploads per UTC day, up to 120-day scheduling horizon. Saved items wait when the AI budget is exhausted. AI review is fallible, not a factual guarantee.
- Article links are editor-supplied canonical CityBeat story URLs, appended server-side; the model cannot invent links. Mixed campaigns should not share one batch link.
- Images are normalized JPEGs in the existing public media bucket. Do not upload confidential or unlicensed material.

## Scheduler

Reuse `citybeat-social`, `us-central1`, project `kerstenblueprint`, authenticated with its existing bearer secret. Schedule `*/10 * * * *`, timezone `America/Denver`, existing URI plus `?limit=5&queue=1`. The normal article/roundup workflow runs only at the 11 AM tick. No extra scheduler or paid feed is created.

## Rollback

Pause the queue and scheduler before reverting traffic. Do not run the previous queue implementation against new queued records: it publishes immediately. Keep the safe new worker disabled until a forward fix is available. Preserve all queue documents and slot reservations.
