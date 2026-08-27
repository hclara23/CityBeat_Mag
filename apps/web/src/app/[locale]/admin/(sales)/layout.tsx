import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

// Server-side gate for rep-facing /admin/* pages: the Sales Desk
// (sales/me, the legacy sales/new redirect) and the paid-order approval
// queues it feeds into (jobs, campaigns). hasSalesAccess is a superset of
// hasAdminAccess (admins/editors/developers can always reach these too), so
// this only WIDENS access relative to (protected) — a plain sales rep
// (is_sales / sales_dashboard_enabled, no admin role) now gets in instead of
// bouncing at the door. 2FA is still mandatory: these pages create Stripe
// checkouts and approve paid listings, which is privileged enough to require
// it even without a broader admin role.
export default async function AdminSalesLayout({
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
  if (!hasSalesAccess(profile)) {
    redirect(`/${locale}/`)
  }

  if (!profile?.mfa_enabled) {
    redirect(`/${locale}/account/security?required=1`)
  }

  return <>{children}</>
}
