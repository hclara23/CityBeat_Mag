'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

interface Listing {
  id: string
  name: string
  claim_status: string
}

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

// The self-contained, inline-styled badge snippet a business embeds on their own
// site. The <a href> is the point: every business that adds it is a backlink to
// CityBeat (raising domain authority → better rankings for everyone) plus
// referral traffic and social proof. No external CSS/JS/image dependency, so it
// renders on any site builder (Wix, Squarespace, WordPress, plain HTML).
function snippetFor(id: string, name: string, locale: string): string {
  const url = `${BASE}/${locale}/directory/${id}`
  const label = locale === 'es' ? 'Presentado en' : 'Featured on'
  return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:9999px;background:#0b0f17;color:#fff;font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border:1px solid #22d3ee">
  <span style="color:#94a3b8;font-weight:600">${label}</span>
  <span>city<span style="color:#22d3ee;font-style:italic">BEat</span></span>
</a>`
}

export function FeaturedBadge() {
  const locale = useLocale() as 'en' | 'es'
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [copied, setCopied] = useState<string>('')

  useEffect(() => {
    fetch('/api/directory/mine')
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => setListings((d.listings || []).filter((l: Listing) => l.claim_status === 'approved')))
      .catch(() => setListings([]))
  }, [])

  if (listings === null || listings.length === 0) return null

  const copy = (id: string, name: string) => {
    navigator.clipboard?.writeText(snippetFor(id, name, locale)).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(''), 2500)
    })
  }

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-2">{locale === 'es' ? 'Tu insignia "Presentado en CityBeat"' : 'Your "Featured on CityBeat" badge'}</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        {locale === 'es'
          ? 'Agrega esta insignia a tu sitio web. Genera confianza con tus clientes y crea un enlace que mejora tu posición en Google.'
          : 'Add this badge to your website. It builds trust with customers and creates a link back that boosts your Google ranking.'}
      </p>

      <div className="grid gap-4">
        {listings.map((l) => (
          <div key={l.id} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
            <p className="font-bold text-gray-900 mb-3">{l.name}</p>
            {/* Live preview */}
            <div className="mb-3" dangerouslySetInnerHTML={{ __html: snippetFor(l.id, l.name, locale) }} />
            {/* The snippet to copy */}
            <textarea
              readOnly
              value={snippetFor(l.id, l.name, locale)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-28 rounded-md border border-gray-300 bg-white p-3 font-mono text-[11px] text-gray-700"
            />
            <button
              onClick={() => copy(l.id, l.name)}
              className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-gray-700"
            >
              {copied === l.id ? (locale === 'es' ? '¡Copiado!' : 'Copied!') : locale === 'es' ? 'Copiar código' : 'Copy code'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
