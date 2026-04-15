import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function PortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: stats } = await supabase
    .from('ad_campaigns')
    .select('status', { count: 'exact' })
    .eq('created_by', user.id)

  const activeCount = (stats as { status: string }[] | null)?.filter((s) => s.status === 'active').length || 0
  const totalCount = stats?.length || 0

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-2xl text-ink">Advertiser Dashboard</h2>
        <p className="mt-2 text-sm text-ink/70">
          Manage your campaign performance and launch new ad placements.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Total Campaigns
          </p>
          <p className="mt-2 text-3xl font-display text-ink">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Active Now
          </p>
          <p className="mt-2 text-3xl font-display text-accent">{activeCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/80 p-8 shadow-sm">
        <h3 className="font-display text-xl text-ink">Quick Actions</h3>
        <p className="mt-2 text-sm text-ink/70">
          Upload your creative, pick a placement window, and complete payment in
          Stripe test mode.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
          <Link
            href="/portal/campaigns"
            className="rounded-full border border-ink/20 px-5 py-2.5 text-ink transition hover:border-ink/40 hover:bg-paper"
          >
            View Campaigns
          </Link>
          <Link
            href="/portal/campaigns/new"
            className="rounded-full bg-ink px-5 py-2.5 text-white transition hover:opacity-90 shadow-md"
          >
            Create New
          </Link>
        </div>
      </div>
    </section>
  )
}
