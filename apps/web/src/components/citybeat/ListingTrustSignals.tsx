'use client'

import { listingTrustSignalKeys, type TrustSignalKey } from '@/lib/premium-value'
import type { ListingPost } from '@/lib/listing-content'

const COPY: Record<TrustSignalKey, { en: string; es: string; icon: string }> = {
  verified: { en: 'Verified owner', es: 'Propietario verificado', icon: '✓' },
  fresh: { en: 'Recently updated', es: 'Actualizado recientemente', icon: '↻' },
  responsive: { en: 'Responds to reviews', es: 'Responde reseñas', icon: '💬' },
  offer: { en: 'Offer available', es: 'Oferta disponible', icon: '★' },
  answers: { en: 'Answers customer questions', es: 'Responde preguntas', icon: '?' },
  milestone: { en: '100+ recent views', es: '100+ vistas recientes', icon: '↗' },
}

export function ListingTrustSignals({
  locale,
  claimStatus,
  updatedAt,
  posts,
  hasOwnerReply,
  hasOwnerAnswer,
  views30,
}: {
  locale: 'en' | 'es'
  claimStatus?: string | null
  updatedAt?: string | null
  posts?: ListingPost[] | null
  hasOwnerReply?: boolean
  hasOwnerAnswer?: boolean
  views30?: number
}) {
  const keys = listingTrustSignalKeys({ claimStatus, updatedAt, posts, hasOwnerReply, hasOwnerAnswer, views30 })
  if (keys.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2" aria-label={locale === 'es' ? 'Señales de confianza' : 'Trust signals'}>
      {keys.map((key) => {
        const item = COPY[key]
        return (
          <span key={key} className="inline-flex items-center gap-1.5 rounded-full border border-brand-neon/25 bg-brand-neon/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-brand-neon">
            <span aria-hidden>{item.icon}</span>{item[locale]}
          </span>
        )
      })}
    </div>
  )
}
