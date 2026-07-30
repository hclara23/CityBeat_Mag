import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

export default async function DeveloperLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const locale = params.locale || 'en'
  const user = await getServerUser()
  if (!user) {
    redirect(`/${locale}/login?redirectTo=/developer`)
  }

  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) {
    redirect(`/${locale}/`)
  }

  if (!profile?.mfa_enabled) {
    redirect(`/${locale}/account/security?required=1`)
  }

  return <>{children}</>
}
