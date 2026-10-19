import sitemap from '@/lib/public-sitemap'
import { serializeSitemap } from '@/lib/sitemap-xml'

export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(serializeSitemap(await sitemap()), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
