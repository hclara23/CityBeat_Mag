import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'
import { getOrCreateConnectedAccount } from '@/lib/platform/stripe-connect'

export const dynamic = 'force-dynamic'

function getCookieStore() {
  const cookieStore = cookies()
  return {
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  }
}

function sameOriginUrl(value: unknown, request: NextRequest, fallbackPath: string) {
  const fallback = new URL(fallbackPath, request.nextUrl.origin)
  if (typeof value !== 'string' || !value.trim()) return fallback.toString()

  try {
    const parsed = new URL(value, request.nextUrl.origin)
    return parsed.origin === request.nextUrl.origin ? parsed.toString() : fallback.toString()
  } catch {
    return fallback.toString()
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = getCookieStore()
  const user = await getServerUser(cookieStore)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient(cookieStore)

  try {
    const body = await request.json().catch(() => ({}))
    const { stripe, account } = await getOrCreateConnectedAccount({
      supabase,
      profileId: user.id,
      email: user.email,
    })

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: sameOriginUrl(body.refreshUrl, request, '/account'),
      return_url: sameOriginUrl(body.returnUrl, request, '/account'),
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create onboarding link' }, { status: 500 })
  }
}
