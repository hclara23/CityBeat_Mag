import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'
import { getExistingConnectedAccount, getOrCreateConnectedAccount, getStripe, syncConnectedAccount } from '@/lib/platform/stripe-connect'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  }
}

export async function GET() {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(cookieStore)
  const existing = await getExistingConnectedAccount(supabase, user.id)

  if (!existing?.stripe_account_id) {
    return NextResponse.json({ account: null })
  }

  try {
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(existing.stripe_account_id)
    const synced = await syncConnectedAccount(supabase, user.id, account)
    return NextResponse.json({ account: synced })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load connected account' }, { status: 500 })
  }
}

export async function POST() {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(cookieStore)

  try {
    const { row } = await getOrCreateConnectedAccount({
      supabase,
      profileId: user.id,
      email: user.email,
    })

    return NextResponse.json({ account: row })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create connected account' }, { status: 500 })
  }
}
