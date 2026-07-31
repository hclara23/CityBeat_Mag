import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { getClientIp } from '@/lib/auth-security'
import { directoryPlanForListing } from '@/lib/directory-entitlements'
import {
  AudienceRow,
  audienceExportFilename,
  buildAudienceCsv,
  emptyAudienceRow,
  isAudienceDataset,
  matchesAudienceSearch,
} from '@/lib/audience'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_ROWS = 5000

function iso(v: any): string {
  if (!v) return ''
  if (v?.toDate) return v.toDate().toISOString().slice(0, 10)
  return typeof v === 'string' ? v.slice(0, 10) : ''
}

// Each dataset returns ONLY safe AudienceRow columns — sensitive fields are never
// read into the projection, so no export can leak them.
async function loadDataset(dataset: string): Promise<AudienceRow[]> {
  const rows: AudienceRow[] = []

  if (dataset === 'profiles') {
    const snap = await adminDb.collection('profiles').limit(MAX_ROWS).get()
    for (const d of snap.docs) {
      const p = d.data() as any
      rows.push({
        ...emptyAudienceRow(),
        name: p.full_name || '',
        email: p.email || '',
        user_id: d.id,
        customer_type: p.is_advertiser ? 'advertiser' : p.role || 'reader',
        plan: '',
        newsletter_status: '',
        locale: p.locale || 'en',
        created_at: iso(p.created_at),
      })
    }
    return rows
  }

  if (dataset === 'newsletter_active' || dataset === 'newsletter_suppressed') {
    const snap = await adminDb.collection('newsletter_subscribers').limit(MAX_ROWS).get()
    for (const d of snap.docs) {
      const s = d.data() as any
      const status = s.status || 'active'
      const suppressed = status === 'unsubscribed' || status === 'complained' || status === 'bounced'
      if (dataset === 'newsletter_active' && suppressed) continue
      if (dataset === 'newsletter_suppressed' && !suppressed) continue
      rows.push({
        ...emptyAudienceRow(),
        name: '',
        email: s.email_display || s.email || '',
        user_id: s.user_id || '',
        customer_type: 'newsletter',
        newsletter_status: status,
        consent_source: s.consent_source || s.source || '',
        consent_date: iso(s.consent_timestamp || s.created_at),
        locale: s.consent_locale || s.locale || 'en',
        created_at: iso(s.created_at),
      })
    }
    return rows
  }

  // Directory-listing-derived datasets.
  const listingDatasets: Record<string, (l: any) => boolean> = {
    directory_owners: (l) => l.claim_status === 'approved' && Boolean(l.owner_id),
    free_listings: (l) => (l.requested_product_id === 'directory_basic_free' || l.plan === 'basic') && l.tier === 'basic',
    founders: (l) => Boolean(l.founding_member) && l.tier !== 'basic',
    premium: (l) => l.tier === 'premium' && !l.founding_member,
    featured: (l) => l.tier === 'featured',
  }
  if (dataset in listingDatasets) {
    const keep = listingDatasets[dataset]
    const snap = await adminDb.collection('directory_listings').limit(MAX_ROWS).get()
    for (const d of snap.docs) {
      const l = { id: d.id, ...(d.data() as any) }
      if (!keep(l)) continue
      rows.push({
        ...emptyAudienceRow(),
        name: '',
        email: l.contact_email || l.email || '',
        user_id: l.owner_id || '',
        customer_type: 'directory',
        business_name: l.name || '',
        business_id: d.id,
        plan: directoryPlanForListing(l),
        payment_state: l.stripe_subscription_id ? 'active_subscription' : l.tier === 'basic' ? 'free' : 'pending',
        locale: l.locale || 'en',
        created_at: iso(l.created_at),
        last_activity: iso(l.updated_at),
      })
    }
    return rows
  }

  if (dataset === 'sales_customers') {
    const snap = await adminDb.collection('sales_orders').limit(MAX_ROWS).get()
    for (const d of snap.docs) {
      const o = d.data() as any
      rows.push({
        ...emptyAudienceRow(),
        name: o.business_name || '',
        email: o.contact_email || '',
        user_id: '',
        customer_type: o.product_family || 'sales',
        business_name: o.business_name || '',
        business_id: o.listing_id || '',
        plan: o.product_name || o.product_id || '',
        payment_state: o.payment_status || 'pending',
        locale: o.locale || 'en',
        created_at: iso(o.created_at),
      })
    }
    return rows
  }

  return rows
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)

  // Developer-only — server-enforced, NOT the client redirect. Log unauthorized
  // attempts through the security-alert path.
  if (!hasDeveloperAccess(profile)) {
    void adminDb
      .collection('security_events')
      .add({
        type: 'audience_access_denied',
        actor_id: user.id,
        ip_present: Boolean(getClientIp(request)),
        at: new Date().toISOString(),
      })
      .catch(() => {})
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = new URL(request.url).searchParams
  const dataset = params.get('dataset') || 'profiles'
  if (!isAudienceDataset(dataset)) {
    return NextResponse.json({ error: 'Unknown dataset' }, { status: 400 })
  }
  const search = params.get('q') || ''
  const format = params.get('format')

  let rows = await loadDataset(dataset)
  if (search) rows = rows.filter((r) => matchesAudienceSearch(r, search))

  if (format === 'csv') {
    const utcDate = new Date().toISOString().slice(0, 10)
    // Audit every export: actor, dataset, filters, row count, timestamp.
    await adminDb
      .collection('audience_exports')
      .add({
        actor_id: user.id,
        dataset,
        filters: { q: search },
        row_count: rows.length,
        at: FieldValue.serverTimestamp(),
      })
      .catch(() => {})
    return new NextResponse(buildAudienceCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${audienceExportFilename(dataset, utcDate)}"`,
      },
    })
  }

  // Paginated JSON for the console.
  const page = Math.max(0, Number(params.get('page')) || 0)
  const pageSize = Math.min(100, Math.max(10, Number(params.get('pageSize')) || 50))
  const total = rows.length
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize)
  return NextResponse.json({ dataset, total, page, pageSize, rows: pageRows })
}
