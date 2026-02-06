import { NextRequest, NextResponse } from 'next/server'

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // TODO: Extract and verify JWT from Authorization header
  return null
}

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

    // TODO: Update campaign status to 'active' in Supabase
    // const supabase = createServerClient({...})
    // const { data: campaign, error } = await supabase
    //   .from('campaigns')
    //   .update({ status: 'active', updated_at: new Date().toISOString() })
    //   .eq('id', campaignId)
    //   .eq('advertiser_id', userId)
    //   .select()
    //   .single()
    //
    // if (error) throw error

    return NextResponse.json({
      data: {
        id: campaignId,
        status: 'active',
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
