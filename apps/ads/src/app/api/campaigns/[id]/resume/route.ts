import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, getUserIdFromRequest } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

    const supabase = getSupabaseAdmin()
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update({ status: 'active' })
      .eq('id', campaignId)
      .eq('advertiser_id', userId)
      .select('id,status')
      .single()

    if (error) throw error

    return NextResponse.json({
      data: {
        id: campaign.id,
        status: campaign.status,
        message: 'Campaign resumed successfully',
      },
    })
  } catch (error) {
    console.error('Error resuming campaign:', error)
    return NextResponse.json(
      { error: 'Failed to resume campaign' },
      { status: 500 }
    )
  }
}
