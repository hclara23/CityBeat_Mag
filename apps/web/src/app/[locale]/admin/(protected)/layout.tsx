import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

// Server-side gate for editorial/admin-only /admin/* pages (claims, directory
// manager, events, finance, leads, payouts, review queue, scrapeflow, the
// godmode sales agent, and the Admin Hub itself). The parent layout already
// confirmed a user is signed in; this adds the actual role check plus the
// mandatory 2FA enrollment for privileged accounts.
export default async function AdminProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const locale = params.locale || 'en'
  const user = await getServerUser()
  if (!user) redirect(`/${locale}/login?redirectTo=/admin`)

  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) {
    redirect(`/${locale}/`)
  }

  if (!profile?.mfa_enabled) {
    redirect(`/${locale}/account/security?required=1`)
  }

  return <>{children}</>
}
