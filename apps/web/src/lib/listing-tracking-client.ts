import type { ClientListingEvent } from './listing-tracking'

// Deliberately no retry: navigation stays immediate and a network failure may
// occur after the server has already incremented the counter.
export function sendListingAction(
  listingId: string,
  type: ClientListingEvent,
  observe: () => void,
  transport: typeof fetch = fetch,
) {
  try { observe() } catch { /* optional third-party analytics */ }
  try {
    void transport('/api/track/listing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, type }), keepalive: true,
    }).catch(() => {})
  } catch { /* tracking must never interrupt the link's default action */ }
}

// One view per displayed listing, not per metadata refresh or effect replay.
export function createListingViewRecorder() {
  let lastId: string | null = null
  return (id: string, loadedId: string | undefined, record: () => void) => {
    if (!id || loadedId !== id || lastId === id) return
    lastId = id
    record()
  }
}
