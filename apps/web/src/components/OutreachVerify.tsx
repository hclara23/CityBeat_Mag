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
export function OutreachVerify() {
  useEffect(() => {
    let id: string | null = null
    try {
      const url = new URL(window.location.href)
      id = url.searchParams.get('cb_o')
      if (!id) return
      url.searchParams.delete('cb_o')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    } catch {
      return
    }
    if (!id || !/^[A-Za-z0-9]{10,40}$/.test(id)) return
    try {
      if (sessionStorage.getItem(`cb_verified_${id}`)) return
    } catch {
      /* storage blocked: still report once for this page view */
    }

    const loadedAt = Date.now()
    let sent = false
    const report = () => {
      if (sent || document.visibilityState !== 'visible') return
      sent = true
      try {
        sessionStorage.setItem(`cb_verified_${id}`, '1')
      } catch {
        /* ignore */
      }
      fetch('/api/track/engaged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ o: id }),
        keepalive: true,
      }).catch(() => {})
      cleanup()
    }
    const onInput = (e: Event) => {
      if (e.isTrusted && Date.now() - loadedAt > 800) report()
    }
    const onScroll = (e: Event) => {
      if (e.isTrusted && Date.now() - loadedAt > 3000) report()
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
