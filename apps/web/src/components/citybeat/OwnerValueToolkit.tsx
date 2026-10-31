'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { deterministicSocialCaptions } from '@/lib/premium-value'
import { qrCampaignUrl } from '@/lib/listing-campaign'

type PixelConfig = { enabled: boolean; domains: string[]; last_seen_at: string | null; last_event: string | null; snippet: string }

export function OwnerValueToolkit({ listingId, name, website, locale, canPixel }: { listingId: string; name: string; website: string; locale: 'en' | 'es'; canPixel: boolean }) {
  const isEs = locale === 'es'
  const [origin, setOrigin] = useState('https://citybeatmag.co')
  const [listingQr, setListingQr] = useState('')
  const [reviewQr, setReviewQr] = useState('')
  const [socialQr, setSocialQr] = useState('')
  const [pixel, setPixel] = useState<PixelConfig | null>(null)
  const [pixelDomain, setPixelDomain] = useState('')
  const [pixelMessage, setPixelMessage] = useState('')
  const shortUrl = `${origin}/b/${listingId}`
  const reviewUrl = `${shortUrl}#reviews`
  const captions = useMemo(() => deterministicSocialCaptions({ name, url: shortUrl, locale }), [name, shortUrl, locale])
  const embed = `<a href="${shortUrl}" rel="noopener"><strong>${isEs ? 'Encuéntranos' : 'Find us'} on CityBeat</strong></a>`

  useEffect(() => {
    const value = window.location.origin
    setOrigin(value)
  }, [])
  useEffect(() => {
    QRCode.toDataURL(qrCampaignUrl(shortUrl,'listing',locale), { width: 420, margin: 2, errorCorrectionLevel: 'M' }).then(setListingQr).catch(() => {})
    QRCode.toDataURL(qrCampaignUrl(reviewUrl,'reviews',locale), { width: 420, margin: 2, errorCorrectionLevel: 'M' }).then(setReviewQr).catch(() => {})
    QRCode.toDataURL(qrCampaignUrl(shortUrl,'social-card',locale), { width: 420, margin: 2, errorCorrectionLevel: 'M' }).then(setSocialQr).catch(() => {})
  }, [shortUrl, reviewUrl,locale])
  useEffect(() => {
    if (!canPixel) return
    fetch(`/api/directory/${listingId}/pixel`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((value: PixelConfig) => {
        setPixel(value)
        setPixelDomain(value.domains[0] || (() => { try { return new URL(website).hostname.replace(/^www\./, '') } catch { return '' } })())
      })
      .catch(() => setPixelMessage(isEs ? 'No se pudo cargar la configuración del píxel.' : 'Could not load pixel settings.'))
  }, [canPixel, listingId, website, isEs])

  const copy = (value: string) => navigator.clipboard?.writeText(value)
  const downloadSocialCard = async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx || !socialQr) return
    ctx.fillStyle = '#080b0d'
    ctx.fillRect(0, 0, 1080, 1080)
    ctx.fillStyle = '#22d3ee'
    ctx.fillRect(0, 0, 1080, 24)
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 58px Arial'
    ctx.fillText(isEs ? 'ENCUÉNTRANOS EN CITYBEAT' : 'FIND US ON CITYBEAT', 72, 130)
    ctx.font = '900 72px Arial'
    const displayName = name.length > 24 ? `${name.slice(0, 23)}…` : name
    ctx.fillText(displayName.toUpperCase(), 72, 245)
    ctx.fillStyle = '#b8c0c4'
    ctx.font = '32px Arial'
    ctx.fillText(isEs ? 'Escanea para ver horarios, ofertas y reseñas.' : 'Scan for hours, offers, and reviews.', 72, 320)
    const image = new Image()
    image.src = socialQr
    await new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve() })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(290, 390, 500, 500)
    ctx.drawImage(image, 320, 420, 440, 440)
    ctx.fillStyle = '#22d3ee'
    ctx.font = '700 28px Arial'
    ctx.fillText(shortUrl, 72, 1000)
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = 'citybeat-social-card.png'
    anchor.click()
  }
  const updatePixel = async (method: 'PUT' | 'POST' | 'DELETE') => {
    setPixelMessage('')
    const response = await fetch(`/api/directory/${listingId}/pixel`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'PUT' ? JSON.stringify({ domains: pixelDomain.split(',').map((v) => v.trim()), enabled: true }) : undefined,
    })
    const value = await response.json().catch(() => ({}))
    if (!response.ok) {
      setPixelMessage(value.error || (isEs ? 'No se pudo guardar.' : 'Could not save.'))
      return
    }
    setPixel(value)
    setPixelMessage(isEs ? 'Configuración guardada.' : 'Settings saved.')
  }
  const downloadSnippet = () => {
    if (!pixel?.snippet) return
    const blob = new Blob([`${pixel.snippet}\n\n<!-- Optional conversion event: -->\n<script>window.citybeatPixel && window.citybeatPixel('conversion')</script>\n`], { type: 'text/plain' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'citybeat-conversion-pixel.txt'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-neon/25 bg-brand-neon/[0.05] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon">{isEs ? 'Enlace corto de CityBeat' : 'CityBeat short link'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="max-w-full overflow-x-auto rounded bg-black/35 px-3 py-2 text-sm text-white">{shortUrl}</code>
          <button type="button" onClick={() => copy(shortUrl)} className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-white/10">{isEs ? 'Copiar' : 'Copy'}</button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {[
          { title: isEs ? 'Encuéntranos en CityBeat' : 'Find us on CityBeat', qr: listingQr, url: shortUrl, file: 'citybeat-listing-qr.png' },
          { title: isEs ? 'Déjanos una reseña' : 'Leave us a review', qr: reviewQr, url: reviewUrl, file: 'citybeat-review-qr.png' },
        ].map((card) => (
          <article key={card.file} className="rounded-2xl border border-white/10 bg-black/25 p-5 text-center print:border-black print:bg-white print:text-black">
            <p className="font-display text-xl font-black uppercase">{card.title}</p>
            <p className="mt-1 text-sm text-white/55 print:text-black/70">{name}</p>
            {/* Data-URL QR images are generated in-browser and cannot use Next Image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {card.qr && <img src={card.qr} alt={card.title} className="mx-auto mt-4 h-44 w-44 rounded bg-white p-2" />}
            <div className="mt-4 flex justify-center gap-2 print:hidden">
              <a href={card.qr} download={card.file} className="rounded-md bg-brand-neon px-3 py-2 text-[10px] font-black uppercase text-black">{isEs ? 'Descargar PNG' : 'Download PNG'}</a>
              <button type="button" onClick={() => copy(card.url)} className="rounded-md border border-white/20 px-3 py-2 text-[10px] font-black uppercase text-white">{isEs ? 'Copiar enlace' : 'Copy link'}</button>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-6">
        <h3 className="font-black uppercase">{isEs ? 'Textos listos para compartir' : 'Ready-to-share captions'}</h3>
        <div className="mt-4 space-y-3">
          {captions.map((caption) => <div key={caption} className="flex items-start gap-3 rounded-lg border border-white/10 p-3"><p className="flex-1 text-sm text-white/70">{caption}</p><button type="button" onClick={() => copy(caption)} className="text-xs font-black uppercase text-brand-neon">{isEs ? 'Copiar' : 'Copy'}</button></div>)}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-6">
        <h3 className="font-black uppercase">{isEs ? 'Insignia para tu sitio web' : 'Badge for your website'}</h3>
        <div className="mt-3 inline-flex rounded-full border border-brand-neon/40 bg-brand-neon/10 px-4 py-2 text-xs font-black uppercase text-brand-neon">✓ {isEs ? 'Perfil verificado en CityBeat' : 'Verified on CityBeat'}</div>
        <pre className="mt-4 overflow-x-auto rounded bg-black/40 p-3 text-xs text-white/60">{embed}</pre>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={() => copy(embed)} className="rounded-md border border-brand-neon/40 px-3 py-2 text-xs font-black uppercase text-brand-neon">{isEs ? 'Copiar código' : 'Copy code'}</button>
          <button type="button" onClick={() => window.print()} className="rounded-md border border-white/20 px-3 py-2 text-xs font-black uppercase text-white">{isEs ? 'Imprimir kit' : 'Print toolkit'}</button>
          <button type="button" onClick={() => void downloadSocialCard()} className="rounded-md bg-brand-neon px-3 py-2 text-xs font-black uppercase text-black">{isEs ? 'Descargar gráfico social' : 'Download social graphic'}</button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon">CityBeat Conversion Pixel</p>
            <p className="mt-2 text-sm text-white/75">{isEs ? 'Mide actividad de todas las fuentes, no solo de CityBeat. Los eventos de conversión son definidos por ti; no prueban ventas, ingresos ni atribución a CityBeat.' : 'Measures activity from all sources, not just CityBeat. Conversion events are defined by you; they do not prove sales, revenue or CityBeat attribution.'}</p>
            <h3 className="mt-1 font-black uppercase">{isEs ? 'Mide resultados en tu propio sitio' : 'Measure results on your own website'}</h3>
          </div>
          {canPixel && pixel?.enabled ? <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-300">{isEs ? 'Activo' : 'Active'}</span> : null}
        </div>
        {!canPixel ? (
          <p className="mt-3 text-sm text-white/60">{isEs ? 'El píxel sin cookies está incluido con Premium. Actualiza para medir visitas y conversiones de tu sitio.' : 'The cookieless pixel is included with Premium. Upgrade to measure website visits and conversions.'}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-bold uppercase text-white/60">{isEs ? 'Dominios permitidos (separados por comas)' : 'Allowed domains (comma-separated)'}
              <input value={pixelDomain} onChange={(e) => setPixelDomain(e.target.value)} placeholder="example.com" className="mt-2 w-full rounded-md border border-white/15 bg-black/40 p-3 text-sm text-white" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void updatePixel('PUT')} className="rounded-md bg-brand-neon px-3 py-2 text-xs font-black uppercase text-black">{pixel?.snippet ? (isEs ? 'Guardar' : 'Save') : (isEs ? 'Crear píxel' : 'Create pixel')}</button>
              {pixel?.snippet ? <button type="button" onClick={() => copy(pixel.snippet)} className="rounded-md border border-white/20 px-3 py-2 text-xs font-black uppercase text-white">{isEs ? 'Copiar código' : 'Copy code'}</button> : null}
              {pixel?.snippet ? <button type="button" onClick={downloadSnippet} className="rounded-md border border-white/20 px-3 py-2 text-xs font-black uppercase text-white">{isEs ? 'Descargar' : 'Download'}</button> : null}
              {pixel?.snippet ? <button type="button" onClick={() => void updatePixel('POST')} className="rounded-md border border-amber-400/30 px-3 py-2 text-xs font-black uppercase text-amber-300">{isEs ? 'Rotar clave' : 'Rotate key'}</button> : null}
              {pixel?.enabled ? <button type="button" onClick={() => void updatePixel('DELETE')} className="rounded-md border border-red-400/30 px-3 py-2 text-xs font-black uppercase text-red-300">{isEs ? 'Desactivar' : 'Disable'}</button> : null}
            </div>
            {pixel?.snippet ? <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs text-white/60">{pixel.snippet}</pre> : null}
            {pixel?.last_seen_at ? <p className="text-xs text-emerald-300">✓ {isEs ? 'Última señal recibida' : 'Last signal received'}: {new Date(pixel.last_seen_at).toLocaleString()}</p> : pixel?.snippet ? <p className="text-xs text-amber-200">{isEs ? 'Esperando la primera señal. Instala el código antes de </body>.' : 'Waiting for the first signal. Install the code before </body>.'}</p> : null}
            <p className="text-xs text-white/45">{isEs ? "Sin cookies ni perfiles de visitantes. Para marcar una conversión usa window.citybeatPixel('conversion') o data-citybeat-conversion=\"conversion\" en un botón." : "No cookies or visitor profiles. To mark a conversion, call window.citybeatPixel('conversion') or add data-citybeat-conversion=\"conversion\" to a button."}</p>
            {pixelMessage ? <p className="text-xs font-bold text-brand-neon">{pixelMessage}</p> : null}
          </div>
        )}
      </div>
    </div>
  )
}
