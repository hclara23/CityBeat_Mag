import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { getExistingConnectedAccount, getOrCreateConnectedAccount, getStripe, syncConnectedAccount } from '@/lib/platform/stripe-connect'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getExistingConnectedAccount(user.id)

  if (!existing?.stripe_account_id) {
    return NextResponse.json({ account: null })
  }

  try {
    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(existing.stripe_account_id)
    const synced = await syncConnectedAccount(user.id, account)
    return NextResponse.json({ account: synced })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load connected account' }, { status: 500 })
  }
}

export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { row } = await getOrCreateConnectedAccount({
      profileId: user.id,
      email: user.email,
    })

    return NextResponse.json({ account: row })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create connected account' }, { status: 500 })
  }
}
