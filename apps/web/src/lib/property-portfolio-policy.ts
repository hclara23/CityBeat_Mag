import { PROPERTY_TYPES, type CommunityType } from './apartments'

export class PortfolioError extends Error {
  constructor(public code: string, public status = 409) { super(code) }
}
export function requirePortfolio(condition: unknown, code: string, status = 409): asserts condition {
  if (!condition) throw new PortfolioError(code, status)
}
export const uniqueIds = (value: unknown): string[] => {
  requirePortfolio(Array.isArray(value) && value.length > 0 && value.length <= 200, 'select_properties', 400)
  requirePortfolio(value.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(id)), 'invalid_property', 400)
  return [...new Set(value)]
}
export function rentalInput(input: Record<string, unknown>) {
  const text = (key: string, max: number, required = true) => {
    const value = typeof input[key] === 'string' ? input[key].trim() : ''
    requirePortfolio((!required || value.length > 0) && value.length <= max, `invalid_${key}`, 400)
    return value
  }
  const type = text('property_type', 40) as CommunityType
  requirePortfolio(Object.prototype.hasOwnProperty.call(PROPERTY_TYPES, type), 'invalid_property_type', 400)
  const phone = text('phone', 30).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  requirePortfolio(/^[2-9]\d{2}[2-9]\d{6}$/.test(phone), 'invalid_phone', 400)
  const website = text('website', 500, false)
  if (website) requirePortfolio(safePropertyUrl(website), 'invalid_website', 400)
  const zip = text('zip', 10)
  requirePortfolio(/^\d{5}(?:-\d{4})?$/.test(zip), 'invalid_zip', 400)
  const state = text('state', 2).toUpperCase()
  requirePortfolio(/^[A-Z]{2}$/.test(state), 'invalid_state', 400)
  return { name: text('name', 160), address: text('address', 250), city: text('city', 100), state, zip,
    property_type: type, phone: `+1${phone}`, website,
    description: text('description', 4000, false), description_es: text('description_es', 4000, false) }
}
export function safePropertyUrl(value: string) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
export function bulkPropertyPatch(input: unknown) {
  requirePortfolio(input && typeof input === 'object' && !Array.isArray(input), 'invalid_changes', 400)
  const patch: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    requirePortfolio(['phone', 'website', 'description', 'description_es'].includes(key) && typeof value === 'string', 'invalid_changes', 400)
    const text = value.trim()
    requirePortfolio(text.length > 0 && text.length <= (key.startsWith('description') ? 4000 : 500), 'invalid_changes', 400)
    if (key === 'website') requirePortfolio(safePropertyUrl(text), 'invalid_website', 400)
    if (key === 'phone') {
      const phone = text.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
      requirePortfolio(/^[2-9]\d{2}[2-9]\d{6}$/.test(phone), 'invalid_phone', 400)
      patch.phone = `+1${phone}`
    } else patch[key] = text
  }
  requirePortfolio(Object.keys(patch).length > 0, 'invalid_changes', 400)
  return patch
}
export function ownsPortfolio(account: Record<string, any> | undefined, uid: string) {
  return Boolean(account && account.status === 'approved' && account.owner_id === uid)
}
export function ownsPortfolioListing(account: Record<string, any>, listing: Record<string, any> | undefined, id: string) {
  return Boolean(listing && account.listing_ids?.includes(id) && listing.owner_id === account.owner_id &&
    listing.property_account_id === account.id && listing.claim_status === 'approved')
}
