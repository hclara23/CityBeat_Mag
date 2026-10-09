export const PREMIER_PROMO = 'premier_cover_30day'
export const PREMIER_LISTING = 'premier-clinic'
export const PREMIER_MONTHLY_CENTS = 999
export const PREMIER_PROMO_DAYS = 30

export function promotionDaysLeft(until: string, now = Date.now()) {
  const deadline = Date.parse(until)
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 86400000)) : 0
}

export function premierPaymentConfirmed(session: Record<string, any>) {
  return session.metadata?.promo_id === PREMIER_PROMO && session.metadata?.listing_id === PREMIER_LISTING &&
    session.mode === 'subscription' && session.payment_status === 'paid' && session.amount_total === PREMIER_MONTHLY_CENTS &&
    session.currency === 'usd' && Boolean(session.subscription)
}

export function premierGrant(now: Date) {
  const until = new Date(now.getTime() + PREMIER_PROMO_DAYS * 86400000).toISOString()
  return { tier: 'premium', comp_tier: 'premium', comp_source: PREMIER_PROMO,
    comp_granted_at: now.toISOString(), comp_until: until, founders_offer_until: until,
    comp_reminder_sent_at: null, comp_reminders_enabled: false, sponsored_until: until,
    updated_at: now.toISOString() }
}

export function isPremierPromotion(listing: Record<string, any>) {
  return listing.id === PREMIER_LISTING && listing.comp_source === PREMIER_PROMO
}

export function premierOfferOpen(listing: Record<string, any>, now = Date.now()) {
  return isPremierPromotion(listing) && Date.parse(listing.founders_offer_until) > now
}

export function canAccessPremierOffer(listing: Record<string, any>, user: { id: string; email?: string; email_verified?: boolean }) {
  const email = typeof listing.promotion_recipient_email === 'string' ? listing.promotion_recipient_email.trim().toLowerCase() : ''
  return isPremierPromotion(listing) && Boolean(email) && user.email_verified === true &&
    user.email?.trim().toLowerCase() === email && (!listing.owner_id || listing.owner_id === user.id)
}

export function premierExpiryExtras(listing: Record<string, any>) {
  return listing.comp_source === PREMIER_PROMO && !listing.stripe_subscription_id
    ? { is_sponsored: false, pending_sponsored: null } : {}
}
