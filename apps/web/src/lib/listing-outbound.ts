export type ListingOutboundChannel =
  | 'website'
  | 'social_facebook'
  | 'social_instagram'
  | 'social_twitter'
  | 'action_booking'
  | 'action_order'
  | 'action_quote'
  | 'action_menu'
  | 'post_cta'

// Directory phone values come from owners and public-source imports, so keep
// only dialable characters and suppress links that contain no digits.
export function listingPhoneHref(value: string | null | undefined): string | null {
  const dialable = String(value || '').trim().replace(/[^\d+]/g, '')
  if (!/\d/.test(dialable)) return null
  return `tel:${dialable}`
}

// Add stable, privacy-safe attribution without replacing a destination's own
// query string or fragment. Non-HTTP schemes (tel:, mailto:) pass through.
export function attributedListingUrl(
  value: string,
  listingId: string,
  channel: ListingOutboundChannel
): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'citybeatmag.co')
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'referral')
    if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', `directory_${channel}`)
    if (!url.searchParams.has('utm_content')) url.searchParams.set('utm_content', listingId)
    return url.toString()
  } catch {
    return value
  }
}
