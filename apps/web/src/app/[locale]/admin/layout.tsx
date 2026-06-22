import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/supabase/roles'

export const dynamic = 'force-dynamic'

// Server-side gate for every /admin/* page. Authorization is enforced HERE (not
// in client components) so the admin UI is never delivered to non-admins, and
// admins are forced to enroll 2FA before reaching any admin tooling.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const locale = params.locale || 'en'
  const user = await getServerUser()
  if (!user) {
    redirect(`/${locale}/login?redirectTo=/admin`)
  }

  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) {
    redirect(`/${locale}/`)
  }

  // 2FA is mandatory for privileged accounts.
  if (!profile?.mfa_enabled) {
    redirect(`/${locale}/account/security?required=1`)
  }

  return <>{children}</>
}
