import { NextRequest, NextResponse } from 'next/server'

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  // TODO: Extract and verify JWT from Authorization header
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

    // TODO: Fetch campaign from Supabase and verify ownership
    // const supabase = createServerClient({...})
    // const { data: campaign, error } = await supabase
    //   .from('campaigns')
    //   .select('*')
    //   .eq('id', campaignId)
    //   .eq('advertiser_id', userId)
    //   .single()
    //
    // if (error) throw error
    // if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Mock data
    const campaign = {
      id: campaignId,
      name: 'Summer Sale 2024',
      status: 'active',
      adType: 'banner',
      billingCycle: 'monthly',
      impressions: 125600,
      clicks: 2856,
      conversions: 142,
    }

    return NextResponse.json({ data: campaign })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id
    const body = await request.json()

    // TODO: Update campaign in Supabase
    // const supabase = createServerClient({...})
    // const { data: campaign, error } = await supabase
    //   .from('campaigns')
    //   .update(body)
    //   .eq('id', campaignId)
    //   .eq('advertiser_id', userId)
    //   .select()
    //   .single()
    //
    // if (error) throw error

    const updatedCampaign = {
      id: campaignId,
      ...body,
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({ data: updatedCampaign })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const campaignId = params.id

    // TODO: Delete campaign from Supabase
    // const supabase = createServerClient({...})
    // const { error } = await supabase
    //   .from('campaigns')
    //   .delete()
    //   .eq('id', campaignId)
    //   .eq('advertiser_id', userId)
    //
    // if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}
