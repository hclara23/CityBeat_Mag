import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserIdFromRequest, isAdvertiser } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdvertiser(userId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const campaignId = params.id

    const supabase = getSupabaseAdmin()
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId)
      .eq('advertiser_id', userId)
      .select('id,status')
      .single()

    if (error) throw error

    return NextResponse.json({
      data: {
        id: campaign.id,
        status: campaign.status,
        message: 'Campaign paused successfully',
      },
    })
  } catch (error) {
    console.error('Error pausing campaign:', error)
    return NextResponse.json(
      { error: 'Failed to pause campaign' },
      { status: 500 }
    )
  }
}
