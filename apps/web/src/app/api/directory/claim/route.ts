import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'
import Stripe from 'stripe'

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

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: 'Stripe configuration missing' },
      { status: 500 }
    )
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-08-16',
  })

  try {
    const { listingId } = await request.json()
    if (!listingId) {
      return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
    }

    const cookieStore = getCookieStore()
    const user = await getServerUser(cookieStore)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient(cookieStore)

    // Check if listing exists and is unclaimed or owned by current user
    const { data: listing, error: listingError } = await supabase
      .from('directory_listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.claim_status === 'approved' && listing.owner_id !== user.id) {
      return NextResponse.json({ error: 'Listing is already claimed and approved' }, { status: 400 })
    }

    const origin = request.headers.get('origin') || new URL(request.url).origin

    // Create a Checkout Session for $19/mo subscription
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 1900, // $19.00
            recurring: {
              interval: 'month',
            },
            product_data: {
              name: `CityBeat Directory Premium: ${listing.name}`,
              description: `Claim and upgrade your business listing to Premium. Access high-res photo gallery, custom description, social media links, and open hours.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/directory/${listing.id}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/directory/${listing.id}?status=cancel`,
      metadata: {
        listing_id: listing.id,
        owner_id: user.id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Error creating claim checkout session:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
