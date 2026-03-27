import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: campaigns } = await supabase
    .from('ad_campaigns')
    .select('id, status, start_at, end_at, ad_placements(name)')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'paused':
        return 'text-gray-600 bg-gray-50'
      case 'ended':
        return 'text-gray-400 bg-gray-50'
      default:
        return 'text-ink/60'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display">All Campaigns</h2>
        <Link
          href="/advertiser/campaigns/new"
          className="rounded bg-accent px-4 py-2 text-xs uppercase tracking-[0.2em] text-white hover:bg-accent/90"
        >
          New Campaign
        </Link>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/20">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink/60">
                  Placement
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink/60">
                  Start Date
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink/60">
                  End Date
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink/60">
                  Status
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-ink/10 hover:bg-paper">
                  <td className="px-4 py-3">
                    {(campaign.ad_placements as any)?.name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(campaign.start_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(campaign.end_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-medium capitalize ${getStatusColor(
                        campaign.status
                      )}`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/advertiser/campaigns/${campaign.id}`}
                      className="text-xs text-accent hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded bg-paper p-8 text-center">
          <p className="text-ink/60">No campaigns yet.</p>
          <Link
            href="/advertiser/campaigns/new"
            className="mt-4 inline-block text-xs text-accent hover:underline"
          >
            Create your first campaign
          </Link>
        </div>
      )}
    </div>
  )
}
