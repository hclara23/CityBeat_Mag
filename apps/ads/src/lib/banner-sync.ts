import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

// Maps a free-form campaign placement to a display-banner placement slot.
function mapPlacement(raw: any): 'home_top' | 'directory' | 'sidebar' {
  const s = String(raw || '').toLowerCase()
  if (s.includes('dir')) return 'directory'
  if (s.includes('side')) return 'sidebar'
  return 'home_top'
}

// Mirrors a paid ad campaign into the public `ad_banners` collection that the
// main site renders. Idempotent (one banner per campaign, id `campaign_<id>`).
// A campaign with no usable image is skipped — a banner needs a creative.
export async function syncCampaignBanner(campaignId: string, opts: { active: boolean }) {
  if (!campaignId) return

  const campaignDoc = await adminDb.collection('ad_campaigns').doc(campaignId).get()
  if (!campaignDoc.exists) return
  const c = campaignDoc.data() as any

  // Only banner-type campaigns become display banners.
  const isBanner = c.ad_type === 'banner' || c.adType === 'banner' || Boolean(c.banner_url)

  // Fall back to a linked creative (the /api/checkout flow stores these).
  let creative: any = null
  try {
    const cs = await adminDb.collection('ad_creatives').where('campaign_id', '==', campaignId).limit(1).get()
    if (!cs.empty) creative = cs.docs[0].data()
  } catch {
    /* ignore */
  }

  const imageUrl = c.banner_url || creative?.asset_path || null
  if (!isBanner && !creative) return
  if (!imageUrl) return // cannot render a banner without an image

  const bannerRef = adminDb.collection('ad_banners').doc(`campaign_${campaignId}`)
  await bannerRef.set(
    {
      sponsor_name: c.advertiser_name || c.name || 'Sponsor',
      title: c.name || null,
      description: c.description || creative?.alt_text || null,
      image_url: imageUrl,
      link_url: c.destination_url || creative?.destination_url || null,
      placement: mapPlacement(c.placement),
      locale: 'all',
      priority: Number(c.priority) || 0,
      is_active: opts.active,
      campaign_id: campaignId,
      advertiser_id: c.advertiser_id || null,
      source: 'ad_campaign',
      updated_at: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}
