import { NextRequest, NextResponse } from 'next/server'
import { sanityServerClient } from '@/lib/sanity'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const query = `
      *[_type == "brief" && status == "published"] | order(publishedAt desc) [$offset...$offset + $limit] {
        _id,
        title,
        content,
        contentEN,
        contentES,
        category,
        publishedAt,
        source
      }
    `

    const briefs = await sanityServerClient.fetch(query, { offset, limit })

    return NextResponse.json({
      data: briefs,
      total: briefs.length,
      limit,
      offset,
      locale,
    })
  } catch (error) {
    console.error('Error fetching briefs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch briefs' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented' },
    { status: 501 }
  )
}
