'use client'

import { useEffect } from 'react'

// Confirms a sales-email click came from a PERSON (lib/lead-heat.ts, VERIFIED).
//
// /api/track/click appends ?cb_o=<outreachId> to the landing URL. Here we strip
// it from the address bar immediately (so a shared or bookmarked link never
// carries it), then wait for a genuine interaction before reporting:
//   - a tap, click or key press, or
//   - a scroll after the page has been visible for a few seconds
// Mail scanners and link-preview bots load the page and leave; they do not do
// either. Some advanced sandboxes do simulate input, so the dwell requirement
// on scroll matters, and this remains strong evidence rather than a guarantee.
//
// The pending id lives in sessionStorage, NOT in this component's closure. The
// layout can mount this component more than once in a page load; the first
// instance strips the URL and a later one would otherwise find nothing to report
// — the first live test did exactly that. Keeping it in the session also means
// an interaction on the NEXT page of the same visit still counts.

const PENDING = 'cb_pending_outreach'
const DONE = (id: string) => `cb_verified_${id}`
const ID_RE = /^[A-Za-z0-9]{10,40}$/

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    /* storage blocked: this page view still reports via the in-memory fallback */
  }
}

let memoryPending: string | null = null

export function OutreachVerify() {
  useEffect(() => {
    // 1) Adopt an id from the URL, then remove it from the address bar.
    try {
      const url = new URL(window.location.href)
      const fromUrl = url.searchParams.get('cb_o')
      if (fromUrl) {
        url.searchParams.delete('cb_o')
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
        if (ID_RE.test(fromUrl) && !read(DONE(fromUrl))) {
          memoryPending = fromUrl
          write(PENDING, fromUrl)
        }
      }
    } catch {
      /* ignore */
    }

    // 2) Whatever is pending — from this URL or an earlier page of the visit.
    const id = read(PENDING) || memoryPending
    if (!id || !ID_RE.test(id)) return

    const armedAt = Date.now()
    let sent = false
    const report = () => {
      if (sent || document.visibilityState !== 'visible') return
      sent = true
      write(DONE(id), '1')
      write(PENDING, null)
      memoryPending = null
      fetch('/api/track/engaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ o: id }),
        keepalive: true,
      }).catch(() => {})
      cleanup()
    }
    const onInput = (e: Event) => {
      if (e.isTrusted && Date.now() - armedAt > 800) report()
    }
    const onScroll = (e: Event) => {
      if (e.isTrusted && Date.now() - armedAt > 3000) report()
    }
    const inputEvents = ['pointerdown', 'keydown', 'touchstart'] as const
    const cleanup = () => {
      inputEvents.forEach((t) => window.removeEventListener(t, onInput, true))
      window.removeEventListener('scroll', onScroll, true)
    }
    inputEvents.forEach((t) => window.addEventListener(t, onInput, { capture: true, passive: true }))
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return cleanup
  }, [])
  return null
}
