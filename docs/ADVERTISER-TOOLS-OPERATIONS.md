# Advertiser tools: operating guide

## Owner website prefill

Open the owner's listing editor, then **Business profile**. Enter the business's public HTTPS website and confirm permission to reuse the information. Preview reads one page, without AI calls or a crawler. Existing fields start unchecked; missing fields can be selected. Check the source, business identity, address and phone before applying. Applying the selection uses the editor's normal save process; confirm the Saved indicator.

Ambiguous locations, unsupported addresses and unsafe/unreadable websites are not guessed. Manual entry remains available. A preview does not change the public listing. Withdrawing confirmation clears it. The preview limit is three per user/listing per hour.

Live verification on 2026-10-31 found that Varsity Roofing's website preview lists Suite 14, while its existing listing says Suite 19. The preview correctly left the existing field unchecked. Confirm the current location with the owner before applying either address; this release did not overwrite it.

For local document extraction, see `scripts/docling-pilot/README.md`. Docling and its models remain on the operator's computer, outside the deployment. Its output is a review artifact, not an automatic listing publication.

## Explain advertiser results accurately

The listing editor's **Analytics** tab separates listing views, website clicks, phone-button clicks, leads and QR-tagged visits. Phone clicks are not completed calls. Website clicks are not confirmed destination sessions. Neither is proof of a sale or revenue.

Download new QR codes from **Marketing toolkit** for listing, review and social-card campaigns. QR visits are already included in listing views and are not unique scans. Older untagged codes still open the listing but cannot retroactively identify a QR campaign. The optional website pixel measures all-source website activity, not automatically CityBeat-attributed sales. Staff/owner listing activity is excluded by the existing authenticated-visitor rules.

## Customer follow-up

Authorized administrators/developers with two-factor authentication use `/en/admin/leads` (or the Spanish locale). Website contact/quote submissions appear automatically. MXroute replies remain in the mailbox: use **Log an email reply** to create an assigned follow-up record. This does not send email or automatically ingest the mailbox.

Assign a responsible person, set **In progress** or **Waiting on customer**, and record a useful internal note. Resolve only after the issue is handled; a resolution note is required. Conflicting edits require a reload. Status changes and their actor are recorded together in an audit event. Internal notes are not exposed in advertiser lead responses.

Chatwoot was evaluated, not installed. See `SUPPORT-AND-SOCIAL-EVALUATION.md` for the hosting/cost decision and source references.

## Social promotion pilot

Authorized staff use `/en/admin/social-queue`. Choose a published paid listing in the approved service area and save a factual local draft. A local draft does not publish anything.

The Postiz adapter requires an already-authorized server-side `POSTIZ_API_KEY`; `POSTIZ_API_URL` defaults to its public API. No Postiz account, hosting, subscription or channel was provisioned by this release. Until configured, scheduling remains unavailable while local drafts work.

When connected, the pilot supports a connected Facebook page and a text/link post. Review the exact caption, page, device-local date/time and displayed UTC time, then explicitly approve. Scheduling is limited to five minutes through ninety days ahead. **Accepted by Postiz** means accepted for scheduling, not published. An uncertain response becomes **Needs review** and is never automatically retried; inspect Postiz before making another post to avoid duplicates. Changing the listing after scheduling does not edit the external post.

For reusable local portrait and landscape video generation, see `scripts/hyperframes-pilot/README.md`. Review the rendered video and QR before manually uploading it to an authorized social tool. The sample is synthetic and marked DRAFT; it is not a customer promotion. No paid image, voice or video service is called.

## Coverage and release safeguards

The permitted cities are El Paso, Horizon City, Canutillo, Socorro (Texas), Clint, Sierra Blanca, Fabens, Anthony (Texas/New Mexico), Las Cruces, Santa Teresa and Sunland Park. New imports require review before publication and cannot overwrite existing owner content or paid tiers.

The release adds no scheduler, subscription or separate hosted stack. Deployment remains on the existing Cloud Run service with candidate checks before promotion. Regression tests cover authorization, cross-origin mutations, concurrent support updates, private review fields, import holds, truthful counters and public QR redirects behind the proxy. The release task records the exact production revision and verification results.
