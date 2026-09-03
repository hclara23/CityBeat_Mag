'use client'

import { useEffect } from 'react'

// Global browser-crash reporter. Catches what the React error boundaries cannot:
// errors thrown outside render (event handlers, timers, async callbacks) and
// unhandled promise rejections — which is most real-world client breakage.
//
// Deliberately defensive: the reporter must never become a second source of
// errors or a way to hammer our own API.
//   • per-page-load cap, so a crash inside a render loop can't fire thousands
//   • local dedupe, so one repeating error is sent once
//   • keepalive fetch, so a report survives the user navigating away
//   • every failure swallowed
const MAX_REPORTS_PER_LOAD = 5

// Mirrors the server-side ignore list. Duplicated deliberately: error-reporting.ts
// imports node:crypto and cannot be pulled into a client bundle.
const CLIENT_IGNORED = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /NetworkError when attempting to fetch/i,
  /The operation was aborted/i,
  /AbortError/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
]

export function reportClientError(message: string, stack?: string | null, digest?: string) {
  try {
    // Drop known noise in the BROWSER so it never costs a budget slot, a request,
    // or a rate-limit token (the server filters again — this is belt and braces).
    if (CLIENT_IGNORED.some((re) => re.test(message) || (stack ? re.test(stack) : false))) return

    const w = window as any
    w.__cbErrSeen = w.__cbErrSeen || new Set<string>()
    const key = `${message}::${(stack || '').slice(0, 200)}`
    if (w.__cbErrSeen.has(key)) return
    // Count only what we actually SEND: incrementing before the dedupe check let
    // N repeats of one error burn N of the 5-report budget while sending once.
    w.__cbErrCount = (w.__cbErrCount || 0) + 1
    if (w.__cbErrCount > MAX_REPORTS_PER_LOAD) return
    w.__cbErrSeen.add(key)

    fetch('/api/telemetry/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: String(message || '').slice(0, 500),
        stack: (stack || '').slice(0, 4000),
        route: window.location.pathname,
        release: process.env.NEXT_PUBLIC_RELEASE || null,
        digest: digest || null,
      }),
    }).catch(() => {})
  } catch {
    /* the reporter never throws */
  }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // Ignore non-error events (e.g. a failed <img>/<script> load fires 'error'
      // on window with no .error and a useless message).
      if (!event?.error && !event?.message) return
      reportClientError(event.message || String(event.error?.message || 'Unknown error'), event.error?.stack)
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event.reason
      const message =
        typeof reason === 'string' ? reason : reason?.message || `Unhandled rejection: ${String(reason).slice(0, 200)}`
      reportClientError(message, reason?.stack)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
