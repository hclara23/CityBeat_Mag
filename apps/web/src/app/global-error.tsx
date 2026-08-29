'use client'

import { useEffect } from 'react'

// Last-resort boundary: catches errors thrown by the ROOT layout itself, where the
// [locale]/error.tsx boundary can't reach. Must render its own <html>/<body>. Kept
// dependency-free and inline-styled so it works even if app CSS/chunks failed to
// load. Also auto-reloads once on a ChunkLoadError (the deploy-transition case).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunkError =
    error?.name === 'ChunkLoadError' || /Loading chunk [\d]+ failed|import\(\) failed/i.test(error?.message || '')

  useEffect(() => {
    if (!isChunkError || typeof window === 'undefined') return
    const KEY = 'cb_chunk_reloaded'
    try {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
      }
    } catch {
      window.location.reload()
    }
  }, [isChunkError])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0b',
          color: '#f5f5f5',
          fontFamily: 'system-ui, Segoe UI, Roboto, Arial, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 460 }}>
          {isChunkError ? (
            <p style={{ color: 'rgba(245,245,245,0.6)', fontSize: 14 }}>Updating…</p>
          ) : (
            <>
              <p style={{ color: '#22d3ee', fontSize: 12, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                CityBeat
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 900, margin: '16px 0 8px' }}>Something went wrong</h1>
              <p style={{ color: 'rgba(245,245,245,0.6)', margin: '0 0 24px' }}>
                We hit a snag. Please reload — if it keeps happening, check back in a moment.
              </p>
              <button
                onClick={() => reset()}
                style={{
                  background: '#22d3ee',
                  color: '#000',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  cursor: 'pointer',
                }}
              >
                Reload
              </button>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
