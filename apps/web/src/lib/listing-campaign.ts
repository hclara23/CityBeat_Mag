export const QR_CAMPAIGNS = ['listing','reviews','social-card'] as const
export type QrCampaign = typeof QR_CAMPAIGNS[number]
export function validQrCampaign(value: unknown): value is QrCampaign {
  return QR_CAMPAIGNS.includes(value as QrCampaign)
}
export function qrCampaignFromSearch(search: string): QrCampaign | undefined {
  const p=new URLSearchParams(search), campaign=p.get('utm_campaign')
  return p.get('utm_source')==='citybeat' && p.get('utm_medium')==='qr' && validQrCampaign(campaign) ? campaign : undefined
}
export function qrCampaignUrl(value: string, campaign: QrCampaign, locale: 'en'|'es'='en') {
  const url=new URL(value)
  url.searchParams.set('utm_source','citybeat');url.searchParams.set('utm_medium','qr');url.searchParams.set('utm_campaign',campaign)
  url.searchParams.set('lang',locale)
  return url.href
}
export function qrCounter(campaign: QrCampaign): 'qr_listing'|'qr_reviews'|'qr_social_card' {
  return campaign==='social-card'?'qr_social_card':campaign==='reviews'?'qr_reviews':'qr_listing'
}
export function listingShortDestination(id: string, requestUrl: string) {
  const incoming=new URL(requestUrl)
  const locale=incoming.searchParams.get('lang')==='es'?'es':'en'
  const url=new URL(`/${locale}/directory/${encodeURIComponent(id)}`,incoming.origin)
  const campaign=qrCampaignFromSearch(incoming.search)
  if(campaign) {
    url.searchParams.set('utm_source','citybeat');url.searchParams.set('utm_medium','qr');url.searchParams.set('utm_campaign',campaign)
    if(campaign==='reviews') url.hash='reviews'
  }
  return url
}
