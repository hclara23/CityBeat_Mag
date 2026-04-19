import { NextRequest, NextResponse } from 'next/server'
import { sanityServerClient } from '@/lib/sanity'
import { localArticles } from '@/lib/localArticles'

function getLocalBriefs() {
  return localArticles.map((article) => ({
    _id: article._id,
    slug: article.slug,
    title: article.title,
    content: article.content,
    contentEN: article.contentEN,
    contentES: article.contentES,
    excerpt: article.excerpt,
    category: article.category,
    publishedAt: article.publishedAt,
    source: article.source,
    author: article.author,
    status: article.status,
    image: article.image,
  }))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const localBriefs = getLocalBriefs()

  try {
    const query = `
      *[_type == "brief" && status == "published"] | order(publishedAt desc) [$offset...$offset + $limit] {
        _id,
        "slug": slug.current,
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
    const combinedBriefs = [
      ...localBriefs,
      ...(Array.isArray(briefs) ? briefs : []),
    ]
    const page = combinedBriefs.slice(offset, offset + limit)

    return NextResponse.json({
      data: page,
      total: combinedBriefs.length,
      limit,
      offset,
      locale,
    })
  } catch (error) {
    console.error('Error fetching briefs:', error)
    const page = localBriefs.slice(offset, offset + limit)

    return NextResponse.json({
      data: page,
      total: localBriefs.length,
      limit,
      offset,
      locale,
      warning: 'Returned local briefs because remote briefs could not be loaded',
    })
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented' },
    { status: 501 }
  )
}
