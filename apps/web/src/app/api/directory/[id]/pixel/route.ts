import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { generatePixelKey, hashPixelKey, normalizePixelDomains } from '@/lib/conversion-pixel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function authorizedListing(id: string) {
  const user = await getServerUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const [profile, doc] = await Promise.all([
    getServerUserProfile(user.id),
    adminDb.collection('directory_listings').doc(id).get(),
  ])
  if (!doc.exists) return { response: NextResponse.json({ error: 'Listing not found' }, { status: 404 }) }
  const listing = doc.data() as Record<string, any>
  const entitlements = resolveEntitlements(listing)
  const isStaff = hasEditorAccess(profile)
  const access = resolveListingPatchAccess(listing, {
    userId: user.id,
    isStaff,
    managerAllowance: entitlements.additionalManagers,
  })
  if (!access.canManage) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  if (!isStaff && !entitlements.fullAnalytics) {
    return { response: NextResponse.json({ error: 'The conversion pixel is included with Premium.', code: 'not_entitled' }, { status: 403 }) }
  }
  return { user, listing, ref: doc.ref, isStaff }
}

function publicConfig(listing: Record<string, any>, id: string) {
  const pixel = listing.conversion_pixel || {}
  const key = typeof pixel.public_key === 'string' ? pixel.public_key : ''
  const src = key ? `https://citybeatmag.co/pixel.js?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}` : ''
  return {
    enabled: pixel.enabled === true,
    domains: Array.isArray(pixel.domains) ? pixel.domains : [],
    last_seen_at: typeof pixel.last_seen_at === 'string' ? pixel.last_seen_at : null,
    last_event: typeof pixel.last_event === 'string' ? pixel.last_event : null,
    script_src: src,
    snippet: src ? `<script async src="${src}"></script>` : '',
  }
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await authorizedListing(params.id)
  if ('response' in result) return result.response
  return NextResponse.json(publicConfig(result.listing, params.id))
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await authorizedListing(params.id)
  if ('response' in result) return result.response
  const body = await request.json().catch(() => ({}))
  const domains = normalizePixelDomains(body.domains)
  if (!domains.length) return NextResponse.json({ error: 'Add at least one valid website domain.' }, { status: 400 })
  const existing = result.listing.conversion_pixel || {}
  const publicKey = typeof existing.public_key === 'string' && existing.public_key ? existing.public_key : generatePixelKey()
  const conversion_pixel = {
    ...existing,
    enabled: body.enabled !== false,
    domains,
    public_key: publicKey,
    key_hash: hashPixelKey(publicKey),
    updated_at: new Date().toISOString(),
    updated_by: result.user.id,
  }
  await result.ref.set({ conversion_pixel }, { merge: true })
  return NextResponse.json(publicConfig({ ...result.listing, conversion_pixel }, params.id))
}

export async function POST(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await authorizedListing(params.id)
  if ('response' in result) return result.response
  const existing = result.listing.conversion_pixel || {}
  const domains = normalizePixelDomains(existing.domains)
  if (!domains.length) return NextResponse.json({ error: 'Configure a domain before rotating the pixel.' }, { status: 400 })
  const publicKey = generatePixelKey()
  const conversion_pixel = {
    ...existing,
    enabled: true,
    public_key: publicKey,
    key_hash: hashPixelKey(publicKey),
    updated_at: new Date().toISOString(),
    updated_by: result.user.id,
  }
  await result.ref.set({ conversion_pixel }, { merge: true })
  return NextResponse.json(publicConfig({ ...result.listing, conversion_pixel }, params.id))
}

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await authorizedListing(params.id)
  if ('response' in result) return result.response
  const conversion_pixel = {
    ...(result.listing.conversion_pixel || {}),
    enabled: false,
    updated_at: new Date().toISOString(),
    updated_by: result.user.id,
  }
  await result.ref.set({ conversion_pixel }, { merge: true })
  return NextResponse.json(publicConfig({ ...result.listing, conversion_pixel }, params.id))
}
