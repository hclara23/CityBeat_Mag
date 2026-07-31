'use client'

// Public rendering for the owner-managed content modules: action links, active
// posts/offers/events, services, products/menu, and attribute badges. Bilingual —
// Spanish visitors see the *_es fields when the owner provided them.

import {
  ACTION_LINK_KEYS,
  ACTION_LINK_LABELS,
  activePosts,
  attributeLabel,
  type ActionLinks,
  type ListingPost,
  type ListingServiceItem,
} from '@/lib/listing-content'

type ContentListing = {
  services?: ListingServiceItem[] | null
  products?: ListingServiceItem[] | null
  posts?: ListingPost[] | null
  attributes?: string[] | null
  action_links?: ActionLinks | null
}

function itemName(item: ListingServiceItem, isEs: boolean): string {
  return (isEs && item.name_es) || item.name
}

function itemDescription(item: ListingServiceItem, isEs: boolean): string {
  return (isEs && item.description_es) || item.description || ''
}

const POST_TYPE_LABEL: Record<ListingPost['type'], { en: string; es: string }> = {
  update: { en: 'Update', es: 'Novedad' },
  offer: { en: 'Offer', es: 'Oferta' },
  event: { en: 'Event', es: 'Evento' },
}

export function ActionLinksBar({ listing, locale }: { listing: ContentListing; locale: 'en' | 'es' }) {
  const links = listing.action_links || {}
  const entries = ACTION_LINK_KEYS.filter((k) => links[k])
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2.5">
      {entries.map((key) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-brand-neon px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
        >
          {ACTION_LINK_LABELS[key][locale]} ↗
        </a>
      ))}
    </div>
  )
}

function ItemsPanel({
  title,
  items,
  isEs,
}: {
  title: string
  items: ListingServiceItem[]
  isEs: boolean
}) {
  if (!items.length) return null
  return (
    <div className="citybeat-panel rounded-2xl border border-white/10 p-8">
      <h2 className="mb-6 font-display text-2xl font-black uppercase tracking-wide text-white">{title}</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 border-b border-white/5 pb-4 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{itemName(item, isEs)}</p>
              {itemDescription(item, isEs) && (
                <p className="mt-1 text-xs leading-5 text-white/55">{itemDescription(item, isEs)}</p>
              )}
            </div>
            {item.price_label && (
              <span className="flex-shrink-0 text-sm font-black text-brand-gold">{item.price_label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListingContentSections({
  listing,
  locale,
}: {
  listing: ContentListing
  locale: 'en' | 'es'
}) {
  const isEs = locale === 'es'
  const posts = activePosts(listing.posts, Date.now())
  const services = Array.isArray(listing.services) ? listing.services.filter((s) => s?.name) : []
  const products = Array.isArray(listing.products) ? listing.products.filter((p) => p?.name) : []
  const attrs = Array.isArray(listing.attributes) ? listing.attributes : []

  if (!posts.length && !services.length && !products.length && !attrs.length) return null

  return (
    <div className="space-y-8">
      {posts.length > 0 && (
        <div className="citybeat-panel rounded-2xl border border-brand-gold/25 p-8">
          <h2 className="mb-6 font-display text-2xl font-black uppercase tracking-wide text-white">
            {isEs ? 'Novedades y ofertas' : "What's happening"}
          </h2>
          <div className="space-y-5">
            {posts.map((post) => (
              <div key={post.id} className="border-b border-white/5 pb-5 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      post.type === 'offer'
                        ? 'bg-brand-gold/20 text-brand-gold'
                        : post.type === 'event'
                          ? 'bg-brand-magenta/20 text-brand-magenta'
                          : 'bg-brand-neon/15 text-brand-neon'
                    }`}
                  >
                    {POST_TYPE_LABEL[post.type][isEs ? 'es' : 'en']}
                  </span>
                  {post.type === 'event' && post.starts_at && (
                    <span className="text-[10px] font-bold text-white/40">{post.starts_at}</span>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold text-white">{(isEs && post.title_es) || post.title}</p>
                {((isEs && post.body_es) || post.body) && (
                  <p className="mt-1 text-xs leading-5 text-white/60 whitespace-pre-line">
                    {(isEs && post.body_es) || post.body}
                  </p>
                )}
                {post.cta_url && (
                  <a
                    href={post.cta_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-black uppercase tracking-wider text-brand-neon hover:underline"
                  >
                    {isEs ? 'Más información' : 'Learn more'} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ItemsPanel title={isEs ? 'Servicios' : 'Services'} items={services} isEs={isEs} />
      <ItemsPanel title={isEs ? 'Productos y menú' : 'Products & Menu'} items={products} isEs={isEs} />

      {attrs.length > 0 && (
        <div className="citybeat-panel rounded-2xl border border-white/10 p-8">
          <h2 className="mb-5 font-display text-2xl font-black uppercase tracking-wide text-white">
            {isEs ? 'Bueno saber' : 'Good to know'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {attrs.map((key) => (
              <span key={key} className="rounded-full border border-brand-neon/25 bg-brand-neon/5 px-3 py-1.5 text-xs font-bold text-white/80">
                ✓ {attributeLabel(key, locale)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SpecialHoursNote({
  specialHours,
  isEs,
}: {
  specialHours: { date: string; hours: string }[] | null | undefined
  isEs: boolean
}) {
  const rows = Array.isArray(specialHours) ? specialHours : []
  // Only upcoming (or today's) overrides matter to visitors.
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = rows.filter((r) => r?.date >= today).slice(0, 6)
  if (!upcoming.length) return null
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-brand-gold">
        {isEs ? 'Horario especial' : 'Special hours'}
      </p>
      <div className="mt-2 space-y-1.5">
        {upcoming.map((row) => (
          <div key={row.date} className="flex justify-between text-xs">
            <span className="font-bold text-white/60">{row.date}</span>
            <span className="text-white/85">{row.hours}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
