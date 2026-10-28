import Link from 'next/link'

/**
 * Prev/next paging for the story archive.
 *
 * Server-rendered links, not a "Load more" button: every page must be its own
 * crawlable URL. The problem this solves is that 91 of 258 published stories
 * were reachable from no page on the site at all — a client-side button would
 * have fixed the reader's path and left the crawler's exactly as it was.
 *
 * Renders nothing for a single page, so a thin category does not carry a
 * pagination strip that implies more exists.
 */
export function StoryPagination({
  basePath,
  page,
  pageCount,
  total,
  locale,
  params = {},
}: {
  /** Already locale-prefixed, e.g. /en/stories */
  basePath: string
  page: number
  pageCount: number
  total: number
  locale: string
  /** Query params to preserve across pages, e.g. { category: 'news' } */
  params?: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null
  const es = locale === 'es'

  const href = (target: number) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    if (target > 1) query.set('page', String(target))
    const qs = query.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // A window around the current page. A 258-story archive is 9 pages; a year of
  // four-a-day briefs is closer to 50, and 50 numbered links is not navigation.
  const first = Math.max(1, page - 2)
  const last = Math.min(pageCount, page + 2)
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i)

  const linkBase =
    'inline-flex min-w-[2.5rem] items-center justify-center rounded border px-3 py-2 text-xs font-bold uppercase tracking-wider transition'
  const idle = 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
  const active = 'border-brand-neon bg-brand-neon text-black'

  return (
    <nav
      className="mt-12 flex flex-wrap items-center gap-2"
      aria-label={es ? 'Paginación de boletines' : 'Story pagination'}
    >
      {page > 1 && (
        <Link href={href(page - 1)} className={`${linkBase} ${idle}`} rel="prev">
          ← {es ? 'Anterior' : 'Previous'}
        </Link>
      )}

      {first > 1 && (
        <>
          <Link href={href(1)} className={`${linkBase} ${idle}`}>1</Link>
          {first > 2 && <span className="px-1 text-white/40">…</span>}
        </>
      )}

      {numbers.map((n) => (
        <Link
          key={n}
          href={href(n)}
          className={`${linkBase} ${n === page ? active : idle}`}
          aria-current={n === page ? 'page' : undefined}
        >
          {n}
        </Link>
      ))}

      {last < pageCount && (
        <>
          {last < pageCount - 1 && <span className="px-1 text-white/40">…</span>}
          <Link href={href(pageCount)} className={`${linkBase} ${idle}`}>{pageCount}</Link>
        </>
      )}

      {page < pageCount && (
        <Link href={href(page + 1)} className={`${linkBase} ${idle}`} rel="next">
          {es ? 'Siguiente' : 'Next'} →
        </Link>
      )}

      <span className="ml-auto text-xs text-white/40">
        {es
          ? `Página ${page} de ${pageCount} · ${total} boletines`
          : `Page ${page} of ${pageCount} · ${total} stories`}
      </span>
    </nav>
  )
}
