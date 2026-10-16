import { activePosts, elPasoDayKey, type ListingPost } from './listing-content'

export const LEAD_STATUSES = ['new', 'contacted', 'won', 'lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export function normalizeLeadStatus(value: unknown): LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus) ? (value as LeadStatus) : 'new'
}

export type CustomerActions = {
  website: number
  directions: number
  actions: number
  leads: number
}

export function customerActionTotal(input: CustomerActions): number {
  return Math.max(0, input.website) + Math.max(0, input.directions) + Math.max(0, input.actions) + Math.max(0, input.leads)
}

export type TrustSignalKey =
  | 'verified'
  | 'fresh'
  | 'responsive'
  | 'offer'
  | 'answers'
  | 'milestone'

export function listingTrustSignalKeys(input: {
  claimStatus?: string | null
  updatedAt?: string | null
  posts?: ListingPost[] | null
  hasOwnerReply?: boolean
  hasOwnerAnswer?: boolean
  views30?: number
  now?: Date
}): TrustSignalKey[] {
  const now = input.now || new Date()
  const keys: TrustSignalKey[] = []
  if (input.claimStatus === 'approved') keys.push('verified')
  if (input.updatedAt) {
    const updated = Date.parse(input.updatedAt)
    if (Number.isFinite(updated) && now.getTime() - updated <= 30 * 86_400_000) keys.push('fresh')
  }
  if (input.hasOwnerReply) keys.push('responsive')
  if (activePosts(input.posts || [], elPasoDayKey(now)).some((p) => p.type === 'offer')) keys.push('offer')
  if (input.hasOwnerAnswer) keys.push('answers')
  if ((input.views30 || 0) >= 100) keys.push('milestone')
  return keys
}

export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null
  const target = Date.parse(`${date}T23:59:59-06:00`)
  if (!Number.isFinite(target)) return null
  return Math.ceil((target - now.getTime()) / 86_400_000)
}

export function deterministicSocialCaptions(input: { name: string; url: string; locale: 'en' | 'es' }) {
  const { name, url, locale } = input
  return locale === 'es'
    ? [
        `Encuéntranos en CityBeat: ${name}. Horarios, ofertas y novedades en ${url}`,
        `¿Ya nos visitaste? Comparte tu experiencia con ${name} en CityBeat: ${url}#reviews`,
        `Apoya a los negocios locales. Conoce a ${name} en CityBeat: ${url}`,
      ]
    : [
        `Find us on CityBeat: ${name}. See our hours, offers, and latest updates at ${url}`,
        `Visited us recently? Share your experience with ${name} on CityBeat: ${url}#reviews`,
        `Support local business. Discover ${name} on CityBeat: ${url}`,
      ]
}
