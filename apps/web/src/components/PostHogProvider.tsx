'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

// Client-side PostHog. Fully dormant until a key is passed in (from the server
// layout reading NEXT_PUBLIC_POSTHOG_KEY at runtime — so it activates without a
// rebuild). Captures pageviews on App Router route changes + session replay.
export function PostHogProvider({
  phKey,
  phHost,
  children,
}: {
  phKey?: string
  phHost?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!phKey || (posthog as any).__loaded) return
    posthog.init(phKey, {
      api_host: phHost || 'https://us.i.posthog.com',
      capture_pageview: false, // we capture manually on route change (App Router)
      capture_pageleave: true,
      person_profiles: 'identified_only',
    })
  }, [phKey, phHost])

  return (
    <>
      {phKey && (
        <Suspense fallback={null}>
          <PageView />
        </Suspense>
      )}
      {children}
    </>
  )
}

function PageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (!(posthog as any).__loaded) return
    let url = window.location.origin + (pathname || '')
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])
  return null
}
