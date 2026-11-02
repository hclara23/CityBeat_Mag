'use client'

import { useState } from 'react'
import type { ApartmentPhoto } from '@/lib/apartment-enrichment'

export function ApartmentThumbnail({ photo, locale }: { photo?: ApartmentPhoto; locale: 'en' | 'es' }) {
  const [failed, setFailed] = useState(false)
  if (!photo || failed) return null
  return <img src={photo.url} alt={photo.caption[locale]} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="aspect-[16/9] w-full rounded-xl object-cover" />
}

export function ApartmentGallery({ photos, locale }: { photos: ApartmentPhoto[]; locale: 'en' | 'es' }) {
  const [failed, setFailed] = useState<string[]>([])
  const es = locale === 'es'
  return <div className="mt-6 grid gap-4 sm:grid-cols-2">{photos.map((photo, index) => <figure key={photo.url} className={`overflow-hidden rounded-xl border border-white/15 bg-brand-ink ${index === 0 ? 'sm:col-span-2' : ''}`}>
    {!failed.includes(photo.url) && <img src={photo.url} alt={photo.caption[locale]} loading={index === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={() => setFailed(previous => [...previous, photo.url])} className="aspect-[16/9] w-full object-cover" />}
    <figcaption className="p-4 text-sm text-white/70">{photo.caption[locale]} <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-neon underline">{es ? 'Fuente de la foto' : 'Photo source'} ↗</a></figcaption>
  </figure>)}</div>
}
