import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { getOrCreateConnectedAccount } from '@/lib/platform/stripe-connect'

export const dynamic = 'force-dynamic'

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

// Stripe onboarding links are single-use and short-lived. If one expires (or the
// user lingers on the final step), Stripe redirects to `refresh_url` instead of
// showing a dead-end error — so we point refresh_url at THIS route's GET handler,
// which silently mints a fresh link and sends the user right back to Stripe.
function refreshUrlFor(request: NextRequest, finalReturn: string) {
  const u = new URL('/api/platform/connect/onboarding', request.nextUrl.origin)
  u.searchParams.set('return', finalReturn)
  return u.toString()
}

async function createOnboardingLink(
  request: NextRequest,
  user: { id: string; email?: string | null },
  finalReturn: string,
) {
  const { stripe, account } = await getOrCreateConnectedAccount({ profileId: user.id, email: user.email })
  return stripe.accountLinks.create({
    account: account.id,
    refresh_url: refreshUrlFor(request, finalReturn),
    return_url: finalReturn,
    type: 'account_onboarding',
  })
}

// Called by the payments page to START onboarding — returns the link URL as JSON.
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const finalReturn = sameOriginUrl(body.returnUrl, request, '/account')
    const accountLink = await createOnboardingLink(request, user, finalReturn)
    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create onboarding link' }, { status: 500 })
  }
}

// Hit by Stripe (browser redirect) when a link expires. Mint a fresh link for the
// SAME signed-in user and 302 them back to Stripe — no dead-end error screen.
export async function GET(request: NextRequest) {
  const finalReturn = sameOriginUrl(request.nextUrl.searchParams.get('return'), request, '/account')
  const user = await getServerUser()
  // Not signed in (rare on return): send to the payments page, which bounces to login.
  if (!user) return NextResponse.redirect(finalReturn)

  try {
    const accountLink = await createOnboardingLink(request, user, finalReturn)
    return NextResponse.redirect(accountLink.url)
  } catch {
    // Never dead-end — return to the payments page so they can retry manually.
    return NextResponse.redirect(finalReturn)
  }
}
