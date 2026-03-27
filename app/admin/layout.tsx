import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase/server'

export default async function AdminLayout({
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

  if (!profile || !['admin', 'editor'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/60">
            Admin Console
          </p>
          <h1 className="font-display text-3xl">Editorial Desk</h1>
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-ink/60">
          {profile.email}
        </div>
      </div>

      <nav className="mb-10 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-ink/60">
        <Link href="/admin" className="hover:text-ink">
          Overview
        </Link>
        <Link href="/admin/articles" className="hover:text-ink">
          Articles
        </Link>
        <Link href="/admin/articles/new" className="hover:text-ink">
          New Article
        </Link>
      </nav>

      {children}
    </div>
  )
}
