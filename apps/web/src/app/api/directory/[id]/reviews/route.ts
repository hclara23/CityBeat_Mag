import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, getServerUser } from '@citybeat/lib/supabase/server'
import { sanitizePublicReview, shouldAwardReviewPoints } from '@/lib/directory-security'

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
    .select('*, profiles:user_id (full_name, avatar_url)')
    .eq('listing_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reviews: (reviews || []).map(sanitizePublicReview) })
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
    const { rating, comment, photo_urls } = await request.json()
    const intRating = parseInt(rating, 10)

    if (isNaN(intRating) || intRating < 1 || intRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }

    const cleanPhotoUrls = Array.isArray(photo_urls) ? photo_urls.filter((u) => typeof u === 'string') : []

    const supabase = createServerClient(cookieStore)

    const { data: existingReview, error: existingReviewError } = await supabase
      .from('directory_reviews')
      .select('id')
      .eq('listing_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingReviewError) {
      return NextResponse.json({ error: existingReviewError.message }, { status: 500 })
    }

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this listing.' },
        { status: 409 }
      )
    }

    // Insert new review
    const { data: newReview, error: insertError } = await supabase
      .from('directory_reviews')
      .insert({
        listing_id: id,
        user_id: user.id,
        rating: intRating,
        comment: comment || '',
        photo_urls: cleanPhotoUrls,
      })
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already reviewed this listing.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Award review points to regular users
    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('is_advertiser, review_points')
      .eq('id', user.id)
      .single()

    if (
      reviewerProfile &&
      shouldAwardReviewPoints({
        isAdvertiser: Boolean(reviewerProfile.is_advertiser),
        hasExistingReview: Boolean(existingReview),
      })
    ) {
      const updatedPoints = (reviewerProfile.review_points || 0) + 10
      await supabase
        .from('profiles')
        .update({ review_points: updatedPoints })
        .eq('id', user.id)
    }

    // Recalculate listing rating aggregates
    const { data: allReviews, error: reviewsError } = await supabase
      .from('directory_reviews')
      .select('rating')
      .eq('listing_id', id)

    let average = 0
    let count = 0

    if (!reviewsError && allReviews) {
      count = allReviews.length
      const sum = allReviews.reduce((acc, curr) => acc + curr.rating, 0)
      average = parseFloat((sum / count).toFixed(2))

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

    // Query listing details and trigger owner notifications
    const { data: listing } = await supabase
      .from('directory_listings')
      .select('name, owner_id')
      .eq('id', id)
      .single()

    if (listing && listing.owner_id) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email, phone_number, email_notifications_enabled, sms_notifications_enabled')
        .eq('id', listing.owner_id)
        .single()

      if (ownerProfile) {
        // Email Notification
        if (ownerProfile.email_notifications_enabled && ownerProfile.email) {
          const emailSubject = `New review for ${listing.name}`
          const emailBody = `Hello,\n\nYour business "${listing.name}" has received a new ${intRating}-star review.\n\nReview comment:\n"${comment || '(No comment)'}"\n\nCheck your directory listing to reply to customers.`
          
          await supabase.from('sent_notifications').insert({
            user_id: listing.owner_id,
            type: 'email',
            recipient: ownerProfile.email,
            subject: emailSubject,
            body: emailBody,
          })
          console.log(`[ALERT EMAIL] Review notification sent to owner email ${ownerProfile.email}`)
        }

        // SMS/Text Notification
        if (ownerProfile.sms_notifications_enabled && ownerProfile.phone_number) {
          const smsBody = `CityBeat Alert: ${listing.name} got a new ${intRating}-star review. Read comment: "${comment ? comment.substring(0, 40) + '...' : 'none'}".`
          
          await supabase.from('sent_notifications').insert({
            user_id: listing.owner_id,
            type: 'sms',
            recipient: ownerProfile.phone_number,
            body: smsBody,
          })
          console.log(`[ALERT SMS] Review notification sent to owner text ${ownerProfile.phone_number}`)
        }
      }
    }

    return NextResponse.json({ review: newReview })
  } catch (error: any) {
    console.error('Error posting review:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
