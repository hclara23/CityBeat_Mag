'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { queueGooglePageView } from '@/lib/analytics-queue'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const CF_TOKEN = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN

type AnalyticsParams = Record<string, string | number | boolean | undefined>

/** Fire-and-forget GA4 event helper. Analytics must never break a user action. */
export function trackAnalyticsEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === 'undefined' || typeof (window as any).gtag !== 'function') return
  try {
    ;(window as any).gtag('event', name, params)
  } catch {
    /* analytics is non-critical */
  }
}

// Records a page view on every route change via two sinks:
//  1. First-party: a beacon to /api/track/pageview (Firestore) so the admin
//     dashboard shows real numbers even before Google Analytics is configured.
//  2. Google Analytics 4: loads gtag and sends page_view, but only when
//     NEXT_PUBLIC_GA_MEASUREMENT_ID is set.
export function Analytics({ nonce }: { nonce?: string }) {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return
    lastPath.current = pathname

    // First-party beacon (always on).
    try {
      const body = JSON.stringify({ path: pathname })
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/pageview', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/track/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      /* ignore */
    }

    // Create the queue synchronously, before the external script can load.
    // A first visit must not disappear just because gtag loads after this effect.
    if (GA_ID) {
      queueGooglePageView(window as any, GA_ID, {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      })
    }
  }, [pathname])

  if (!GA_ID && !CF_TOKEN) return null

  return (
    <>
      {GA_ID ? (
        <>
          <Script nonce={nonce} src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        </>
      ) : null}
      {CF_TOKEN ? (
        <Script
          nonce={nonce}
          src="https://static.cloudflareinsights.com/beacon.min.js"
          strategy="afterInteractive"
          data-cf-beacon={JSON.stringify({ token: CF_TOKEN, spa: true })}
        />
      ) : null}
    </>
  )
}
