import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()

  // Fetch Articles Count
  const { count: articlesCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  // Fetch Sponsors Count (Advertisers)
  const { count: sponsorsCount } = await supabase
    .from('sponsors')
    .select('*', { count: 'exact', head: true })

  // Fetch Active Ads Count
  const { count: activeAdsCount } = await supabase
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Administrative Overview</h2>
          <p className="mt-2 text-sm text-ink/70">
            Monitor platform activity and manage editorial content.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/articles/new"
            className="rounded-full bg-ink px-5 py-2 text-xs uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-ink/90 hover:scale-[1.02]"
          >
            Create Article
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Total Stories
          </p>
          <p className="mt-2 text-4xl font-display text-ink">{articlesCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Sponsors
          </p>
          <p className="mt-2 text-4xl font-display text-ink">{sponsorsCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm transition hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
            Active Campaigns
          </p>
          <p className="mt-2 text-4xl font-display text-accent">{activeAdsCount ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/80 p-8 shadow-sm">
        <h3 className="font-display text-lg text-ink">Management Workspace</h3>
        <p className="mt-2 text-sm text-ink/70">
          Access specialized tools for publishing and asset management.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em]">
          <Link
            href="/admin/articles"
            className="rounded-full border border-ink/20 px-4 py-2 text-ink/70 transition hover:border-ink hover:text-ink hover:bg-paper"
          >
            Manage Library
          </Link>
          <button
            disabled
            className="cursor-not-allowed rounded-full border border-ink/5 px-4 py-2 text-ink/30"
          >
            User Roles (Stub)
          </button>
        </div>
      </div>
    </section>
  )
}
