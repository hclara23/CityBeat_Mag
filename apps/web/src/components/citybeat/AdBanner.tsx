'use client'

import { useEffect, useState } from 'react'

type Banner = {
  id: string
  sponsor_name: string | null
  title: string | null
  description: string | null
  image_url: string | null
  link_url: string | null
  placement: string
}

// Public sponsored banner. Fetches active banners for a placement + locale and
// renders the highest-priority one. Renders nothing when there are no banners,
// so it can be dropped into any layout without leaving an empty slot.
export function AdBanner({
  placement,
  locale = 'en',
  className = '',
}: {
  placement: 'home_top' | 'directory' | 'sidebar'
  locale?: string
  className?: string
}) {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/banners?placement=${encodeURIComponent(placement)}&locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d.banners && d.banners.length) setBanner(d.banners[0])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [placement, locale])

  if (!banner) return null

  const isSidebar = placement === 'sidebar'
  const label = locale === 'es' ? 'Publicidad' : 'Sponsored'

  const inner = (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-charcoal to-brand-dark transition hover:border-brand-gold/60 ${
        isSidebar ? 'p-5' : 'p-5 sm:p-6'
      }`}
    >
      <span className="absolute top-2 right-3 text-[9px] font-black uppercase tracking-widest text-white/30">
        {label}
      </span>
      <div className={isSidebar ? 'flex flex-col gap-3' : 'flex flex-col sm:flex-row items-center gap-5'}>
        {banner.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt={banner.sponsor_name || banner.title || 'Sponsor'}
            className={
              isSidebar
                ? 'w-full h-32 object-cover rounded-lg'
                : 'w-full sm:w-48 h-28 object-cover rounded-lg flex-shrink-0'
            }
          />
        )}
        <div className="min-w-0 flex-1">
          {banner.sponsor_name && (
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-neon">{banner.sponsor_name}</p>
          )}
          {banner.title && (
            /* A promotional banner headline, not a document section — kept as a
               styled <p> so it doesn't break the page's heading outline (h1→h3). */
            <p className="font-display text-lg sm:text-xl font-black uppercase text-white leading-tight mt-1">
              {banner.title}
            </p>
          )}
          {banner.description && (
            <p className="text-xs text-white/70 mt-1.5 leading-relaxed line-clamp-3">{banner.description}</p>
          )}
          {banner.link_url && (
            <span className="inline-block mt-3 text-[11px] font-black uppercase tracking-wider text-brand-gold group-hover:text-yellow-300">
              {locale === 'es' ? 'Saber más' : 'Learn more'} →
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (!banner.link_url) return <div className={className}>{inner}</div>

  return (
    <a
      href={banner.link_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={`block ${className}`}
    >
      {inner}
    </a>
  )
}
