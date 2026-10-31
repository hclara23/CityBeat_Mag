# Customer follow-up and social promotion evaluation

Reviewed 2026-10-31 for the eleven-city CityBeat directory. Constraints: no new recurring service, no subagents, local document/video pilots, and the approved one-time deployment cap.

## Chatwoot decision

Chatwoot is a reasonable future shared-inbox option, but its free Community Edition is a software license, not free managed infrastructure. Its published production deployment requirements include a persistent application host, PostgreSQL and Redis. Adding that stack is outside the approved no-new-monthly-cost scope.

Sources: https://www.chatwoot.com/deploy and https://www.chatwoot.com/pricing/self-hosted-plans . Recheck requirements and pricing before procurement.

For the current app, `/admin/leads` provides a responsible staff member, open/in-progress/waiting/resolved statuses, required resolution notes, atomic audit events and conflict detection. Only existing administrator/developer access with the existing second-factor check can read or change these records. Advertiser-facing lead serialization does not expose staff support notes.

Website contact and quote submissions already persist in the existing inbox. MXroute email remains in the mailbox; this release does **not** claim automatic email ingestion or Chatwoot connectivity. Staff can log a relevant reply, which assigns it to them, then record follow-up and resolution. Logging a reply never sends an email. The inbox displays a bounded recent set rather than claiming an all-time count.

## Operational checks

1. Open Customer follow-up; confirm the request and contact.
2. Choose Assign to me and In progress, then save.
3. Reply through the existing approved mailbox.
4. Record the outcome; choose Waiting on customer or Resolved. Resolution requires a note.
5. If another staff member changed the record, reload before saving. Never overwrite a stale revision.

## Social rollout boundary

Read-only inspection found no Postiz, Chatwoot or HyperFrames configuration on `citybeat-web`. A working adapter and local video template do not themselves authorize a social account. Public promotion requires a configured account/channel and explicit approval of the content. No customer campaign is used as a test, and no paid AI/image/video API is enabled by this work.

Postiz public API reference: https://docs.postiz.com/public-api/posts/create . HyperFrames source and local authoring reference: https://github.com/heygen-com/hyperframes and https://github.com/heygen-com/hyperframes/blob/main/packages/core/docs/core.md .
