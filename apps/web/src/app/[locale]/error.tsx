'use client'

import { useEffect } from 'react'

// Route-level error boundary for the whole localized app. Two jobs:
//  1. Deploy resilience — a new deploy replaces the JS chunk hashes, so any tab
//     open across a deploy throws a ChunkLoadError when it lazy-loads a now-missing
//     chunk. Before this, users saw the raw "Application error" screen. Here we
//     detect that specific error and reload ONCE (sessionStorage-guarded against a
//     loop) so the tab silently picks up the new build.
//  2. Everything else — a branded, bilingual "something went wrong" with Try again
//     (reset the boundary) and Reload, instead of the unstyled Next.js fallback.
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed|Loading CSS chunk|import\(\) failed|dynamically imported module/i.test(error?.message || '')

  const isEs = typeof window !== 'undefined' && /^\/es(\/|$)/.test(window.location.pathname)

  useEffect(() => {
    if (!isChunkError || typeof window === 'undefined') return
    const KEY = 'cb_chunk_reloaded'
    try {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1')
        window.location.reload()
      }
    } catch {
      // sessionStorage blocked — reload anyway; worst case one extra reload.
      window.location.reload()
    }
  }, [isChunkError])

  // Log for observability; never surface internals to the user.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App error boundary:', error?.message, error?.digest)
  }, [error])

  if (isChunkError) {
    // A reload is already in flight — show a neutral "updating" state, not an error.
    return (
      <div className="flex min-h-[60svh] items-center justify-center bg-brand-dark px-6 text-center">
        <p className="text-sm text-white/60">{isEs ? 'Actualizando…' : 'Updating…'}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70svh] flex-col items-center justify-center bg-brand-dark px-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-neon">
        {isEs ? 'Algo salió mal' : 'Something went wrong'}
      </p>
      <h1 className="mt-4 max-w-lg font-display text-3xl font-black text-white">
        {isEs ? 'Tuvimos un problema al cargar esta página.' : 'We hit a snag loading this page.'}
      </h1>
      <p className="mt-3 max-w-md text-white/55">
        {isEs
          ? 'Puedes intentar de nuevo o recargar. Si continúa, vuelve en un momento.'
          : 'You can try again or reload. If it keeps happening, check back in a moment.'}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => reset()}
          className="rounded-md bg-brand-neon px-6 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
        >
          {isEs ? 'Intentar de nuevo' : 'Try again'}
        </button>
        <button
          onClick={() => typeof window !== 'undefined' && window.location.reload()}
          className="rounded-md border border-white/25 px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-white/10"
        >
          {isEs ? 'Recargar' : 'Reload'}
        </button>
      </div>
    </div>
  )
}
