import { redirect } from 'next/navigation'
import { getServerUser } from '@citybeat/lib/firebase/server'

export const dynamic = 'force-dynamic'

// Only "is anyone signed in" is enforced here. The actual role gate is split
// across the two route groups this layout wraps: (protected) requires
// hasAdminAccess (editorial/admin tooling — claims, directory manager, events,
// finance, review queue, scrapeflow, the godmode sales agent), and (sales)
// requires the broader hasSalesAccess (Sales Desk + the paid job/newsletter
// approval queues a rep's own sales feed into) — see each group's layout.tsx.
// A single shared hasAdminAccess check here used to gate the ENTIRE /admin/*
// tree, which silently locked plain sales reps out of the Sales Desk itself
// (login even redirects a sales-only account to /admin/sales/me, straight
// into that bounce) — splitting the gate by route group is what makes "sales
// rep access" actually possible without loosening the editorial-only pages.
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

  return <>{children}</>
}
