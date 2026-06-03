import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser, getServerUserProfile } from '@citybeat/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {
      // Route handlers do not need to write refreshed cookies for these reads.
    },
  }
}

// GET: Fetch single listing details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
  }

  const cookieStore = getCookieStore()
  const supabase = createServerClient(cookieStore)

  const { data: listing, error } = await supabase
    .from('directory_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  return NextResponse.json({ listing })
}

// PATCH: Update premium fields by listing owner (approved) or admin/editor
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getServerUserProfile(user.id, cookieStore)
  const isEditor = profile?.is_editor ?? false

  const supabase = createServerClient(cookieStore)

  // Fetch listing to check ownership and claim status
  const { data: listing, error: fetchError } = await supabase
    .from('directory_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const isOwner = listing.owner_id === user.id && listing.claim_status === 'approved'

  // Only the approved owner or an admin/editor can modify listings
  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  // Define allowed fields to update. Non-premium listings can't use premium fields, but if it is premium or owned/approved we update them.
  // Wait, let's verify if the listing is actually premium before allowing updates to premium fields, OR allow owners to update them (since isOwner is only true if claim_status === 'approved', which implies tier = 'premium').
  const allowedUpdates: Record<string, any> = {}

  // Basic info updates (allowed for owner/editor)
  if ('name' in body) allowedUpdates.name = body.name
  if ('phone' in body) allowedUpdates.phone = body.phone
  if ('website' in body) allowedUpdates.website = body.website

  // Premium only fields
  if (listing.tier === 'premium' || isEditor) {
    if ('description' in body) allowedUpdates.description = body.description
    if ('image_url' in body) allowedUpdates.image_url = body.image_url
    if ('gallery_urls' in body) allowedUpdates.gallery_urls = body.gallery_urls
    if ('social_links' in body) allowedUpdates.social_links = body.social_links
    if ('hours' in body) allowedUpdates.hours = body.hours
  }

  allowedUpdates.updated_at = new Date().toISOString()

  const { data: updatedListing, error: updateError } = await supabase
    .from('directory_listings')
    .update(allowedUpdates)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ listing: updatedListing })
}
