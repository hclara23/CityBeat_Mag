import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/sign-in')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'advertiser'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/60">
            Advertiser Portal
          </p>
          <h1 className="font-display text-3xl">Campaign Desk</h1>
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-ink/60">
          {profile.email}
        </div>
      </div>

      <nav className="mb-10 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-ink/60">
        <Link href="/portal" className="hover:text-ink">
          Overview
        </Link>
        <Link href="/portal/campaigns" className="hover:text-ink">
          Campaigns
        </Link>
        <Link href="/portal/campaigns/new" className="hover:text-ink">
          New Campaign
        </Link>
      </nav>

      {children}
    </div>
  )
}
