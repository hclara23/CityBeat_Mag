import { NextRequest, NextResponse } from 'next/server'

// This endpoint will fetch briefs from Sanity CMS
// For now, returning mock data until Sanity is configured

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'
  const limit = searchParams.get('limit') || '10'
  const offset = searchParams.get('offset') || '0'

  try {
    // TODO: Connect to Sanity client to fetch real briefs
    // const sanity = createClient({
    //   projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    //   dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    //   apiVersion: '2024-01-01',
    //   useCdn: true,
    // })
    //
    // const briefs = await sanity.fetch(`
    //   *[_type == "brief" && language == $locale] | order(_createdAt desc) [$offset...$offset + $limit] {
    //     _id,
    //     title,
    //     description,
    //     content,
    //     category,
    //     image,
    //     publishedAt,
    //     language,
    //     source
    //   }
    // `, { locale, offset: parseInt(offset), limit: parseInt(limit) })

    // Mock data for development
    const briefs = [
      {
        _id: '1',
        title: 'City Council Approves New Transit Plan',
        description: 'The city council has approved a comprehensive transit expansion plan...',
        content: 'Full content here...',
        category: 'Government',
        image: {
          url: 'https://via.placeholder.com/400x250',
        },
        publishedAt: new Date().toISOString(),
        language: locale,
        source: 'Local News',
      },
      {
        _id: '2',
        title: 'Local Tech Company Raises Series A Funding',
        description: 'A prominent local technology company has announced a successful Series A...',
        content: 'Full content here...',
        category: 'Technology',
        image: {
          url: 'https://via.placeholder.com/400x250',
        },
        publishedAt: new Date().toISOString(),
        language: locale,
        source: 'Tech News',
      },
    ]

    return NextResponse.json({
      data: briefs,
      total: 2,
      limit: parseInt(limit),
      offset: parseInt(offset),
    })
  } catch (error) {
    console.error('Error fetching briefs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch briefs' },
      { status: 500 }
    )
  }
}

// POST endpoint for creating new briefs (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // TODO: Validate user is admin/authenticated
    // TODO: Create brief in Sanity
    // const sanity = createClient({...})
    // const result = await sanity.create({
    //   _type: 'brief',
    //   ...body,
    // })

    return NextResponse.json(
      { error: 'Not implemented' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error creating brief:', error)
    return NextResponse.json(
      { error: 'Failed to create brief' },
      { status: 500 }
    )
  }
}
