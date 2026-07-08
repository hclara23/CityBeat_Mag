import { redirect } from 'next/navigation'

// Force per-request rendering. When this was statically optimized, Next.js
// cached the redirect (s-maxage=1yr, X-Nextjs-Cache: HIT) and served it WITHOUT
// a Location header — which Googlebot reported as a "redirect error" that
// blocked indexing of the entire site. force-dynamic makes the locale redirect
// emit a fresh 307 with a valid Location on every request.
export const dynamic = 'force-dynamic'

export default function RootPage() {
  redirect('/en')
}
