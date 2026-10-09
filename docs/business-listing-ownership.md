# Business ownership and print recognition

## Account and ownership boundaries

Google sign-in authenticates a person, not a business. New profiles are readers with no staff, ownership, paid-plan, or newsletter grants. The server checks token revocation, verified email, Google provider, recent authentication and exact origin. Existing profiles and two-factor requirements are preserved.

An approved owner or an entitled manager can use the private listing CMS. A claim requires a code delivered to the business contact on record and CityBeat approval. Code attempts and ownership transitions are transactional. Team invitations require active accounts with verified email. Administrators retain editorial oversight; public pages identify staff edit controls explicitly.

Owners receive account-scoped inbox notifications and preference-controlled activity email. Pending claimants do not receive ordinary owner activity notifications. Google sign-in uses the existing Firebase project; citybeatmag.co was added to its authorized domains while retaining the original entries.

## Print appearances

Cover Feature (gold), Print Coverage (cyan), and Print Advertiser (neutral) are separate staff-verified records, independent of paid listing tiers. Only the administrator route with staff role and second-factor enforcement accepts `print_recognition`. Owner/manager patches cannot set this field. Admin writes are atomically audited and approved owners are notified. Ads are explicitly distinguished from editorial endorsement.

Premier's October–November cover is an authorized historical artifact. The year was not supplied and is intentionally omitted. Former provider Nayeli may appear in this historical cover, but is excluded from the current-provider gallery. Original artwork is unchanged; the website copy is a 1400px WebP, 190680 bytes. See `premier-print-recognition.json` for the reviewed content.

## Google Business Profile: not enabled

Google account sign-in does not authorize access to Google Business Profile. No business.manage scope, refresh token, scheduled Google import, or Pub/Sub subscription is created by this release.

Official Business Profile API policies limit API use to creating, managing, and reporting on authorized profiles, and place restrictions on content storage and aggregation. Owner consent alone does not establish permission for permanent republication into an independent public directory. Automatic Google-to-CityBeat republication remains disabled pending written policy clarification and required project/API approval.

Sources checked October 8, 2026:

- https://developers.google.com/my-business/content/policies
- https://developers.google.com/my-business/content/prereqs
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/content/notification-setup

A permitted future integration must use separate explicit authorization, encrypted refresh-token storage, revocation/disconnect, approved field retention, and change review. Pub/Sub settings must not overwrite an existing agency integration. Until then, owners can update CityBeat directly or provide an authorized first-party feed; neither requires copying Google content.
