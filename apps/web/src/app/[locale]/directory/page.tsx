import DirectoryPageClient from './DirectoryPageClient'

// Every other public page (home, stories, events) declares this. This page
// never did, so Next.js statically prerendered it once at build time and
// Fastly (Firebase Hosting's CDN) cached that single snapshot for its
// default s-maxage — up to a year — so code changes here (categories, the
// search-icon fix, the result cap) could sit invisible to real visitors long
// after deploying. All of this page's actual content loads client-side
// anyway (see DirectoryPageClient's fetch), so the static shell was never
// buying real performance, only staleness. `dynamic` only takes effect from
// a Server Component, which is why it's split out here rather than declared
// alongside the 'use client' page content.
export const dynamic = 'force-dynamic'

export default function DirectoryPage() {
  return <DirectoryPageClient />
}
