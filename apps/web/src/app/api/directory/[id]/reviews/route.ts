import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'

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

// GET: Fetch reviews for a listing, joining reviewer profiles
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const cookieStore = getCookieStore()
  const supabase = createServerClient(cookieStore)

  // Fetch reviews joined with profiles
  const { data: reviews, error } = await supabase
    .from('directory_reviews')
    .select('*, profiles:user_id (full_name, email, avatar_url)')
    .eq('listing_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reviews: reviews || [] })
}

// POST: Leave a review on a listing, updating listing rating averages
export async function POST(
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
    return NextResponse.json({ error: 'Unauthorized. Please log in to leave a review.' }, { status: 401 })
  }

  try {
    const { rating, comment } = await request.json()
    const intRating = parseInt(rating, 10)

    if (isNaN(intRating) || intRating < 1 || intRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }

    const supabase = createServerClient(cookieStore)

    // Insert new review
    const { data: newReview, error: insertError } = await supabase
      .from('directory_reviews')
      .insert({
        listing_id: id,
        user_id: user.id,
        rating: intRating,
        comment: comment || '',
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate average rating and total count
    const { data: allReviews, error: reviewsError } = await supabase
      .from('directory_reviews')
      .select('rating')
      .eq('listing_id', id)

    if (!reviewsError && allReviews) {
      const count = allReviews.length
      const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0)
      const average = parseFloat((sum / count).toFixed(2))

      // Update listing metrics
      await supabase
        .from('directory_listings')
        .update({
          rating: average,
          user_ratings_total: count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    }

    return NextResponse.json({ review: newReview })
  } catch (error: any) {
    console.error('Error posting review:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
