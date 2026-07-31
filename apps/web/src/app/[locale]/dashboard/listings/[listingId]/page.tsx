import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import {
  resolveEntitlements,
  resolveListingPatchAccess,
  directoryPlanForListing,
} from '@/lib/directory-entitlements'
import { DirectoryOwnerCms } from './DirectoryOwnerCms'

export const dynamic = 'force-dynamic'

// A private owner tool — never index it.
export const metadata: Metadata = {
  title: 'Manage listing · CityBeat',
  robots: { index: false, follow: false },
}

type Params = { locale: string; listingId: string }

// Firestore Timestamps → ISO so the data can cross the server→client boundary.
function toPlain(v: any): any {
  if (v == null) return v
  if (typeof v?.toDate === 'function') return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(toPlain)
  if (typeof v === 'object') {
    const o: any = {}
    for (const k of Object.keys(v)) o[k] = toPlain(v[k])
    return o
  }
  return v
}

// Only the fields the owner CMS needs. Financial/internal fields are never sent
// to the client — the CMS renders locked modules without their protected data.
function toOwnerListing(id: string, raw: any) {
  const plain = toPlain(raw)
  return {
    id,
    name: plain.name ?? '',
    category: plain.category ?? '',
    address: plain.address ?? '',
    phone: plain.phone ?? '',
    website: plain.website ?? '',
    description: plain.description ?? '',
    description_es: plain.description_es ?? '',
    image_url: plain.image_url ?? '',
    gallery_urls: Array.isArray(plain.gallery_urls) ? plain.gallery_urls : [],
    social_links: plain.social_links ?? {},
    hours: plain.hours ?? {},
    tier: plain.tier ?? 'basic',
    claim_status: plain.claim_status ?? 'unclaimed',
    is_published: plain.is_published !== false,
    rating: plain.rating ?? null,
    user_ratings_total: plain.user_ratings_total ?? null,
  }
}

export default async function OwnerListingCmsPage({ params }: { params: Params }) {
  const locale = params.locale === 'es' ? 'es' : 'en'

  const user = await getServerUser()
  if (!user) redirect(`/${locale}/login`)

  const profile = await getServerUserProfile(user.id)
  const isStaff = hasEditorAccess(profile)

  const doc = await adminDb.collection('directory_listings').doc(params.listingId).get()
  if (!doc.exists) redirect(`/${locale}/dashboard`)
  const raw = doc.data() as any

  // Server-enforced ownership: only the approved owner or staff may open the CMS.
  const { canManage } = resolveListingPatchAccess(raw, { userId: user.id, isStaff })
  if (!canManage) redirect(`/${locale}/dashboard`)

  const listing = toOwnerListing(doc.id, raw)
  const entitlements = resolveEntitlements(raw)
  const plan = directoryPlanForListing(raw)

  return (
    <DirectoryOwnerCms
      locale={locale}
      listing={listing}
      entitlements={entitlements}
      plan={plan}
      isStaff={isStaff}
    />
  )
}
