# Business ownership and print recognition

## Account and ownership boundaries

Google sign-in authenticates a person, not a business. New profiles are readers with no staff, ownership, paid-plan, or newsletter grants. The server checks token revocation, verified email, Google provider, recent authentication and exact origin. Existing profiles and two-factor requirements are preserved.

An approved owner or an entitled manager can use the private listing CMS. A claim requires a code delivered to the business contact on record and CityBeat approval. Code attempts and ownership transitions are transactional. Team invitations require active accounts with verified email. Administrators retain editorial oversight; public pages identify staff edit controls explicitly.

Owners receive account-scoped inbox notifications and preference-controlled activity email. Pending claimants do not receive ordinary owner activity notifications. Google sign-in uses the existing Firebase project; citybeatmag.co was added to its authorized domains while retaining the original entries.

## Print appearances

Cover Feature (gold), Print Coverage (cyan), and Print Advertiser (neutral) are separate staff-verified records, independent of paid listing tiers. Only the administrator route with staff role and second-factor enforcement accepts `print_recognition`. Owner/manager patches cannot set this field. Admin writes are atomically audited and approved owners are notified. Ads are explicitly distinguished from editorial endorsement.

Premier's October–November cover is an authorized historical artifact. The year was not supplied and is intentionally omitted. Former provider Nayeli may appear in this historical cover, but is excluded from the current-provider gallery. Original artwork is unchanged; the website copy is a 1400px WebP, 190680 bytes. See `premier-print-recognition.json` for the reviewed content.

## Google Business Profile connection

Ordinary Google sign-in still does not authorize Business Profile access. A separate, explicit OAuth flow requests only `business.manage`, encrypts the offline token before storage, supports disconnect/revocation, and shows an import preview before any CityBeat field changes. Google data never silently overwrites CityBeat and CityBeat does not write back to Google in this release.

Official Business Profile API policies limit API use to creating, managing, and reporting on authorized profiles, and place restrictions on content storage and aggregation. Owner consent alone does not establish permission for permanent republication into an independent public directory. Automatic Google-to-CityBeat republication remains disabled pending written policy clarification and required project/API approval.

Sources checked October 8, 2026:

- https://developers.google.com/my-business/content/policies
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/content/notification-setup

The connection remains unavailable until Google approves the Cloud project for Business Profile APIs and the four `GBP_*` runtime secrets are installed. Pub/Sub is intentionally not configured, so an agency's existing notification setup cannot be overwritten. Authorized owners can refresh locations, select the correct profile, preview current profile fields, and manually apply the reviewed snapshot to CityBeat. Every applied import records the prior CityBeat values in the audit log.

### Platform analytics versus advertiser connections

Finance uses `/api/admin/google-business` to connect and explicitly select CityBeat's own profile. This connection is stored separately at `platform_google_business_connections/citybeat`; it never aggregates advertiser records from `google_business_connections`. Both setup and the OAuth callback require an administrator role and enrolled two-factor authentication. The signed OAuth state distinguishes platform reporting from listing imports. Reconnecting clears the selected location so an operator must choose again; selection is verified against the profiles Google currently authorizes. The finance flow does not write public profile or directory fields.

The native Google Analytics product link and this direct API connection are separate. On October 30, 2026, City Beat Magazine was linked to the existing GA4 property `542822471` (account `398927462`). The Cloud Run reporting identity `854761587817-compute@developer.gserviceaccount.com` was granted property-level Viewer access, and production GA4 reports returned real traffic. No new property was created. Direct Search/Maps reporting still requires Business Profile API approval, OAuth configuration, owner authorization, and deployment of the platform connection UI.

Performance responses contain `multiDailyMetricTimeSeries[].dailyMetricTimeSeries[]`. The parser separates Search/Maps impressions from call clicks, website clicks, and direction requests, and rejects malformed responses instead of displaying invented zero success. Empty authorized periods may legitimately contain zero results.
