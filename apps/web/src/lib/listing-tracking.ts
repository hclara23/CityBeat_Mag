import { hasEditorAccess, type PlatformProfile } from '@citybeat/lib/roles'
import { isValidListingEventType, type ListingEventType } from './listing-analytics'

export type ClientListingEvent = Exclude<ListingEventType, 'lead'>
export type TrackingListing = { owner_id?: unknown; manager_ids?: unknown }

export function validTrackingListingId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,120}$/.test(value)
}

export function internalListingVisitor(listing: TrackingListing, userId?: string, profile?: PlatformProfile | null) {
  return Boolean(userId && (listing.owner_id === userId ||
    (Array.isArray(listing.manager_ids) && listing.manager_ids.includes(userId)) || hasEditorAccess(profile)))
}

const AGGREGATE_EVENT: Partial<Record<ListingEventType, 'click_directions' | 'click_action'>> = {
  click_directions_google: 'click_directions', click_directions_apple: 'click_directions',
  click_directions_location: 'click_directions', click_action_booking: 'click_action',
  click_action_order: 'click_action', click_action_quote: 'click_action',
  click_action_menu: 'click_action', click_post_cta: 'click_action',
}

export function listingEventCounters(type: ClientListingEvent): string[] {
  const aggregate = AGGREGATE_EVENT[type]
  return aggregate ? [type, aggregate] : [type]
}

export type TrackingDependencies = {
  allowed: (listingId: string) => Promise<boolean>
  listing: (listingId: string) => Promise<TrackingListing | null>
  visitor: () => Promise<{ id: string; profile?: PlatformProfile | null } | null>
  record: (listingId: string, type: ClientListingEvent) => Promise<void>
  failure: () => void
}

// No automatic retry: a timed-out increment may have committed. Retrying would
// inflate customer actions. HTTP status now distinguishes failures from success.
export async function trackListingRequest(body: unknown, deps: TrackingDependencies) {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const listingId = typeof input.listingId === 'string' ? input.listingId.trim() : ''
  const type = input.type
  if (!validTrackingListingId(listingId) || !isValidListingEventType(type) || type === 'lead') {
    return { status: 400, body: { ok: false } }
  }
  try {
    if (!await deps.allowed(listingId)) return { status: 429, body: { ok: false, reason: 'rate_limited' } }
    const listing = await deps.listing(listingId)
    if (!listing) return { status: 404, body: { ok: false } }
    const visitor = await deps.visitor()
    if (internalListingVisitor(listing, visitor?.id, visitor?.profile)) {
      return { status: 200, body: { ok: true, excluded: true } }
    }
    await deps.record(listingId, type)
    return { status: 200, body: { ok: true, recorded: true } }
  } catch {
    deps.failure()
    return { status: 503, body: { ok: false, reason: 'tracking_unavailable' } }
  }
}
