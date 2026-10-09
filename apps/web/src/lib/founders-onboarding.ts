import { sanitizeHttpUrl } from './listing-content'
import { getPlan } from './pricing'

export const normalizeBusinessKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const text = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max) : ''

/** Allowlist only: browser input can never grant ownership, publication or a paid tier. */
export function parseFoundersBusiness(input: any) {
  const name = text(input?.name, 120)
  const category = text(input?.category, 60)
  const phone = text(input?.phone, 40)
  const description = text(input?.description, 500)
  const addresses: string[] = Array.isArray(input?.addresses) ? input.addresses.map((v: unknown) => text(v, 300)) : []
  if (name.length < 2 || !category || addresses.length < 1 || addresses.length > 10 || addresses.some(a => a.length < 8)) throw new Error('Enter a business name, category and complete address for every location (maximum 10).')
  if (phone.replace(/\D/g, '').length < 10) throw new Error('Enter a valid business phone number.')
  if (new Set(addresses.map(normalizeBusinessKey)).size !== addresses.length) throw new Error('Remove duplicate locations.')
  const website = sanitizeHttpUrl(input?.website)
  const image_url = sanitizeHttpUrl(input?.image_url)
  if ((input?.website && !website) || (input?.image_url && !image_url)) throw new Error('Website and photo links must be valid http or https URLs.')
  if (input?.attested !== true) throw new Error('Confirm you are authorized to represent this business.')
  const hours: Record<string, string> = {}
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    const value = text(input?.hours?.[day], 80)
    if (value) hours[day] = value
  }
  return { name, category, phone, description, address: addresses[0], addresses,
    location_count: addresses.length, website, image_url, hours }
}

export function foundersCheckoutAllowed(listing: Record<string, any>, userId: string): boolean {
  return listing.owner_id === userId && listing.claim_status === 'approved'
}

export function foundersReturnPaths(locale: unknown, listingId: string) {
  const lang = locale === 'es' ? 'es' : 'en'
  return { success: `/${lang}/dashboard?founders_checkout=success`,
    cancel: `/${lang}/founders?listing=${encodeURIComponent(listingId)}&checkout=cancelled` }
}

export function foundersPaymentConfirmed(session: Record<string, any>): boolean {
  const m = session.metadata || {}
  const plan = getPlan(m.plan)
  const quantity = Number(m.billing_quantity)
  return m.source === 'founders_funnel' && Boolean(plan) && ['founding', 'premium_monthly'].includes(m.plan)
    && session.mode === 'subscription' && session.payment_status === 'paid' && session.currency === 'usd'
    && Boolean(session.subscription) && Number.isInteger(quantity) && quantity >= 1
    && (m.plan !== 'founding' || quantity === 1)
    && session.amount_subtotal === plan!.unitAmount * quantity
}
