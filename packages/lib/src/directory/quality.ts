import serviceArea from './service-area.json'

export { serviceArea }
export type LocalityInput = { city?: string | null; state?: string | null; address?: string | null }
export function normalizedText(value: unknown): string {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
export function normalizedAddress(value: unknown): string {
  const words: Record<string, string> = { street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', boulevard: 'blvd', suite: 'ste', texas: 'tx' }
  return normalizedText(value).replace(/\b(street|avenue|road|drive|boulevard|suite|texas)\b/g, word => words[word])
}
export function hasStreetAddress(value: unknown): boolean {
  return /^\d+[a-z-]*\s+\S+/i.test(String(value || '').trim())
}
const stateCode = (v: unknown) => ({ texas: 'TX', 'new mexico': 'NM' }[normalizedText(v)] || String(v || '').trim().toUpperCase())

// Postal locality is evidence for review, not proof of a municipal boundary.
// Never infer a city from a ZIP, telephone area code, business name or broad bbox.
export function assessLocality(input: LocalityInput) {
  const address = input.address || ''
  const parsed = address.match(/,\s*([^,]+),?\s+(TX|NM|Texas|New Mexico)\b(?:\s*,?\s*\d{5}(?:-\d{4})?)?(?:\s*,?\s*(?:USA|US|United States))?\s*$/i)
  const city = String(input.city || parsed?.[1] || '').trim()
  const state = stateCode(input.state || parsed?.[2])
  const match = serviceArea.cities.find(c => c.aliases.includes(normalizedText(city)))
  if (!city || !state) return { status: 'review' as const, reason: 'missing_city_or_state', city, state }
  if (!match || !match.states.includes(state)) return { status: 'outside' as const, reason: 'outside_service_area', city, state }
  if (parsed && ((!match.aliases.includes(normalizedText(parsed[1]))) || stateCode(parsed[2]) !== state)) {
    return { status: 'review' as const, reason: 'conflicting_locality', city, state }
  }
  return { status: 'inside' as const, reason: 'listed_city_requires_location_review', city: match.name, state }
}

export function importedReviewFields(input: LocalityInput, observedAt: string) {
  const locality = assessLocality(input)
  return {
    city: locality.city || null, state: locality.state || null,
    service_area_version: serviceArea.version,
    locality_status: locality.status,
    quality_review_status: 'pending',
    quality_review_reasons: [locality.reason, 'duplicate_check_required', 'source_and_current_operation_review'],
    publication_hold: 'import_quality_review', is_published: false,
    source_observed_at: observedAt, last_verified_at: null,
  }
}
