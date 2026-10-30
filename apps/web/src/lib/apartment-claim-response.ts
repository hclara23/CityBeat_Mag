// The apartment UI translates stable codes instead of exposing provider or server errors.
export function apartmentClaimError(status: number, error: unknown): string {
  const message = String(error || '').toLowerCase()
  if (status === 401) return 'unauthorized'
  if (message.includes('expired')) return 'expired'
  if (message.includes('incorrect attempts') || message === 'please request a new code.') return 'too_many_attempts'
  if (message.includes('invalid verification') || message.includes('missing verification')) return 'invalid_code'
  if (message.includes('no active claim')) return 'no_active_claim'
  if (message.includes('already') || message.includes('pending claim')) return 'already_claimed'
  if (status === 429) return 'rate_limited'
  if (status === 409) return 'conflict'
  if (status === 404) return 'not_found'
  if (status === 502) return 'send_failed'
  if (status === 400) return 'unavailable'
  return 'internal_error'
}
