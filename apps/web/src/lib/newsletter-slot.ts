// Who occupies the newsletter's single "Sponsored by" slot (pure, unit-tested —
// no Firestore, no Next).
//
// The weekly digest sells ONE sponsor unit. It used to resolve that unit with a
// `placement == 'newsletter' && is_active == true` query and `.limit(1)` with no
// orderBy — and Firestore returns those in unspecified order. With two active
// banners the rendered sponsor was arbitrary and could change from send to send:
// one paying sponsor got nothing, and nobody was told. Money was taken for a
// placement that never appeared.
//
// The policy is already decided elsewhere in this codebase — admin/campaigns
// refuses to approve a second concurrent newsletter sponsorship with a 409. This
// module exists so that decision has exactly one definition, so every write path
// enforces it, and so the read is deterministic even when a write path is
// bypassed (a hand-edited Firestore doc, a legacy row, a mirror written before
// the guard existed).
//
// Two rules, and nothing else:
//   • INCUMBENT WINS. Oldest first. If two sponsors are somehow both live, the
//     one who was there first keeps the slot; the newcomer is reported, not
//     silently promoted over a customer who has been paying longer.
//   • The order is TOTAL. Never "whichever Firestore happened to hand back".
//
// Deliberately NOT here: rotating the slot between sponsors. Splitting a unit
// someone bought is the owner's commercial decision, not something a sort
// function should invent. Paging a human on the collision is the decision-free
// behaviour.

export type NewsletterSlotDoc = {
  id: string
  placement?: unknown
  is_active?: unknown
  created_at?: unknown
  updated_at?: unknown
}

export const NEWSLETTER_PLACEMENT = 'newsletter'
export const NEWSLETTER_SLOT_CONFLICT_CODE = 'newsletter_slot_occupied'

/**
 * Milliseconds for whatever a caller stored in a timestamp field, or null when
 * it cannot be read as one.
 *
 * These documents are written by four different code paths across several years:
 * `FieldValue.serverTimestamp()` (reads back as a Firestore Timestamp), an ISO
 * string from the campaign mirror, and — from raw admin edits and older
 * migrations — plain epoch numbers. Anything unrecognised resolves to null
 * rather than NaN, because NaN is the exact trap this module exists to avoid:
 * every comparison against NaN is false, so a comparator that lets one through
 * reports "equal" in both directions and Array.prototype.sort then depends on
 * the input order — which is precisely the nondeterminism we are removing.
 */
function timestampMs(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  const candidate = value as { toMillis?: () => number; toDate?: () => Date; seconds?: unknown; _seconds?: unknown }
  try {
    if (typeof candidate.toMillis === 'function') {
      const ms = candidate.toMillis()
      return typeof ms === 'number' && Number.isFinite(ms) ? ms : null
    }
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate()
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null
    }
  } catch {
    // A malformed Timestamp-shaped object must not take the digest down.
    return null
  }
  // Firestore Timestamps that have been through JSON.stringify keep only their
  // seconds/nanoseconds fields.
  if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) return candidate.seconds * 1000
  if (typeof candidate._seconds === 'number' && Number.isFinite(candidate._seconds)) return candidate._seconds * 1000
  return null
}

/**
 * When this banner started occupying the slot, for incumbency purposes.
 *
 * `created_at` is the real answer, but admin/campaigns mirrors an approved
 * sponsorship to `ad_banners/campaign:<id>` with `updated_at` and NO
 * `created_at` — it writes with `{ merge: true }` so re-approving updates in
 * place, and never sets a creation stamp. Falling back to `updated_at` is what
 * keeps those mirror docs sortable at all; without it every campaign-sold
 * sponsorship would land in the undated bucket together.
 */
export function newsletterSlotHeldSince(doc: NewsletterSlotDoc): number | null {
  const created = timestampMs(doc.created_at)
  return created !== null ? created : timestampMs(doc.updated_at)
}

/**
 * Total order over slot occupants: oldest first, undated last, doc id as the
 * final tie-break.
 *
 * Undated docs sort LAST because a document that cannot show when it arrived
 * cannot be shown to be the incumbent, and the incumbent is the one we protect.
 * The id tie-break is what makes the order total: two docs written in the same
 * server-timestamp millisecond, or two undated docs, must still produce the same
 * winner on every send.
 */
function byIncumbency(a: NewsletterSlotDoc, b: NewsletterSlotDoc): number {
  const aHeld = newsletterSlotHeldSince(a)
  const bHeld = newsletterSlotHeldSince(b)
  if (aHeld !== bHeld) {
    if (aHeld === null) return 1
    if (bHeld === null) return -1
    return aHeld - bHeld
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * The active newsletter occupants among `docs`, incumbent first.
 *
 * `is_active === true` and `placement === 'newsletter'` are checked strictly on
 * purpose: they must mean exactly what the production query
 * `.where('placement','==','newsletter').where('is_active','==',true)` means, or
 * this module would disagree with the rows the callers actually fetch.
 */
function activeNewsletterSlots<T extends NewsletterSlotDoc>(docs: readonly T[]): T[] {
  return docs
    .filter((doc) => doc && doc.is_active === true && doc.placement === NEWSLETTER_PLACEMENT)
    .slice()
    .sort(byIncumbency)
}

/**
 * The one banner the digest should render, plus every other active occupant.
 *
 * A non-empty `conflictIds` means someone is being billed for a placement that
 * is not going out. The digest still sends — the newsletter is never held
 * hostage to a billing dispute — and reports the ids so a human resolves it.
 */
export function pickNewsletterSponsor<T extends NewsletterSlotDoc>(
  docs: readonly T[]
): { sponsor: T | null; conflictIds: string[] } {
  const active = activeNewsletterSlots(docs)
  if (active.length === 0) return { sponsor: null, conflictIds: [] }
  return { sponsor: active[0], conflictIds: active.slice(1).map((doc) => doc.id) }
}

/**
 * The ids that would collide if `excludeId` were made an active newsletter
 * banner — the shared definition behind every 409.
 *
 * `excludeId` is the document being written, so editing the current sponsor in
 * place (renaming it, swapping its creative) does not report the sponsor as
 * conflicting with itself. Pass null/undefined when creating a new document,
 * which by definition has no id yet.
 */
export function newsletterSlotConflict(
  existingDocs: readonly NewsletterSlotDoc[],
  excludeId?: string | null
): string[] {
  return activeNewsletterSlots(existingDocs)
    .filter((doc) => doc.id !== excludeId)
    .map((doc) => doc.id)
}

/**
 * How the occupant is named back to the admin who was refused. Falls through to
 * the doc id so the message can always point at a specific document — an admin
 * who cannot tell WHICH banner is in the way will just try again.
 */
export function newsletterSlotLabel(doc: { id: string; sponsor_name?: unknown; title?: unknown } | null): string {
  if (!doc) return 'another banner'
  const name = typeof doc.sponsor_name === 'string' && doc.sponsor_name.trim() ? doc.sponsor_name.trim() : ''
  const title = typeof doc.title === 'string' && doc.title.trim() ? doc.title.trim() : ''
  return name || title || doc.id
}

/** One wording for the refusal, so all three write paths explain the same rule. */
export function newsletterSlotConflictMessage(occupantLabel: string): string {
  return `The newsletter sponsor slot is already occupied (${occupantLabel}). Deactivate that banner first — a second active newsletter sponsor would bill someone for a placement that never appears.`
}
