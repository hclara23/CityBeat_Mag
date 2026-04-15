import { pb } from '@/src/lib/pocketbase'

export async function AdSlot({ placementKey }: { placementKey: string }) {
  // Fetch active campaign for the given placement key
  let campaign;
  try {
    campaign = await pb.collection('ad_campaigns').getFirstListItem(`placement_key="${placementKey}" && status="active"`, {
      expand: 'sponsor'
    });
  } catch (e) {
    // No active ad found
    return null;
  }

  if (!campaign) {
    return null
  }

  const imageUrl = pb.files.getURL(campaign, campaign.image);
  const destinationUrl = campaign.destination_url || '#';

  // Log impression (soft failure)
  pb.collection('ad_clicks').create({
    campaign: campaign.id,
    clicked_at: (new Date()).toISOString(),
    metadata: { type: 'impression', placement_key: placementKey }
  }).catch(err => console.error('Impression log failed:', err));

  return (
    <a
      href={destinationUrl}
      target="_blank"
      rel="nofollow noopener noreferrer"
      className="block overflow-hidden rounded-2xl border border-white/10 bg-brand-charcoal shadow-lg hover:border-brand-neon/30 transition-all group"
    >
      <img
        src={imageUrl}
        alt={campaign.expand?.sponsor?.name ?? 'Sponsored'}
        className="w-full object-cover"
      />
    </a>
  )
}

