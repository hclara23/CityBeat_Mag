import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { AudienceConsole } from './AudienceConsole'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Audience & Accounts · CityBeat', robots: { index: false, follow: false } }

type Params = { locale: string }

export default async function AudiencePage({ params }: { params: Params }) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  // Server-enforced developer-only — never the client redirect alone.
  const user = await getServerUser()
  if (!user) redirect(`/${locale}/login`)
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) redirect(`/${locale}/`)

  const isEs = locale === 'es'
  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <Link href={`/${locale}/developer`} className="text-xs font-bold uppercase tracking-wider text-brand-neon">
            ← {isEs ? 'Control de desarrollador' : 'Developer control'}
          </Link>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-tight">
            {isEs ? 'Audiencia y cuentas' : 'Audience & Accounts'}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {isEs
              ? 'Clientes, suscriptores y usuarios — solo para desarrolladores. Las exportaciones se auditan.'
              : 'Customers, subscribers, and users — developer-only. Exports are audited.'}
          </p>
        </div>
        <AudienceConsole locale={locale} />
      </main>
    </div>
  )
}
