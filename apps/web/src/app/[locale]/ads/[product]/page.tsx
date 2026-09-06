import { createHash } from 'crypto'
import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { AddToCartButton } from '@/components/citybeat/cart/AddToCartButton'
import { getAdProducts, withLocale, AD_KEY_TO_SALES_PRODUCT, type Locale } from '@/components/citybeat/content'
import type { AdProductKey } from '@/components/citybeat/content'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

type ProductPageProps = {
  params: {
    locale: string
    product: string
  }
  // Reading searchParams makes this route render dynamically instead of being
  // prerendered. That is the price of showing the customer whether their
  // enquiry actually arrived; the page fetches nothing (all copy is static, no
  // Firestore reads), so the cost is CPU, not the read bill.
  searchParams?: { contact?: string }
}

const ADS_INBOX = 'ads@citybeatmag.co'
const INQUIRY_FROM = process.env.LEADS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function generateStaticParams() {
  return (['en', 'es'] as Locale[]).flatMap((locale) =>
    Object.keys(getAdProducts(locale) as Record<AdProductKey, unknown>).map((product) => ({ locale, product }))
  )
}

const formCopy = {
  en: {
    backToAds: 'Back to ads',
    heading: 'Talk to CityBeat about this placement',
    campaignName: 'Campaign name',
    campaignPlaceholder: 'Spring launch',
    email: 'Your email',
    notes: 'Campaign notes',
    notesPlaceholder: 'Audience, timing, creative needs',
    submit: 'Contact Sales',
    directLine: 'Prefer email? Write to',
    ok: 'Thanks — your enquiry reached the CityBeat ads desk. We reply to the address you gave us.',
    badEmail: 'That email address did not look right, so nothing was sent. Please check it and try again.',
    failed: `We could not record that enquiry. Please email ${ADS_INBOX} directly so it does not get lost.`,
    throttled: `Too many enquiries from this connection. Please email ${ADS_INBOX} directly.`,
  },
  es: {
    backToAds: 'Volver a anuncios',
    heading: 'Habla con CityBeat sobre este espacio',
    campaignName: 'Nombre de la campaña',
    campaignPlaceholder: 'Lanzamiento de primavera',
    email: 'Tu correo',
    notes: 'Notas de la campaña',
    notesPlaceholder: 'Público, fechas, necesidades de diseño',
    submit: 'Contactar a ventas',
    directLine: '¿Prefieres correo? Escríbenos a',
    ok: 'Gracias — tu solicitud llegó al equipo de publicidad de CityBeat. Te responderemos al correo que nos diste.',
    badEmail: 'El correo no parece válido, así que no enviamos nada. Revísalo e inténtalo de nuevo.',
    failed: `No pudimos registrar tu solicitud. Escribe directamente a ${ADS_INBOX} para que no se pierda.`,
    throttled: `Demasiadas solicitudes desde esta conexión. Escribe directamente a ${ADS_INBOX}.`,
  },
}

// The bug this closes: these three inputs sat in a <form> whose only "submit"
// was an <a href="mailto:...">. An anchor never serialises sibling fields, so
// every campaign name, email address and paragraph of notes a customer typed
// was discarded — and on a phone with no mail handler the button did nothing at
// all. Nothing was written, nothing was emailed, and no record existed that a
// lead had ever been there. This is a Server Action, so it also works with
// JavaScript disabled.
async function submitAdInquiry(formData: FormData) {
  'use server'

  const str = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max)
  const locale: Locale = formData.get('locale') === 'es' ? 'es' : 'en'
  const productKey = str('product', 80) as AdProductKey
  // Never trust the hidden field: an unknown product key would let anyone post
  // arbitrary rows through a page that does not exist.
  const product = getAdProducts(locale)[productKey]
  const base = withLocale(locale, `/ads/${productKey}`)
  if (!product) redirect(withLocale(locale, '/ads'))

  const campaignName = str('campaignName', 140)
  const email = str('email', 200).toLowerCase()
  const notes = str('notes', 2000)

  if (!EMAIL_PATTERN.test(email)) redirect(`${base}?contact=email`)

  // getClientIp only reads request.headers, and a Server Action has no Request.
  // Hand it the incoming headers rather than re-deriving the trusted-proxy hop
  // logic, which is security-sensitive and belongs in exactly one place.
  const ip = getClientIp({ headers: headers() } as unknown as Request)
  const limit = await checkRateLimit(`ads-inquiry:ip:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) redirect(`${base}?contact=throttled`)

  const message = [campaignName && `Campaign: ${campaignName}`, notes].filter(Boolean).join('\n\n')

  let stored = false
  try {
    // Deterministic id, not .add(): a double-click, a refresh of the POST, or a
    // retry re-writes the SAME row instead of filling the leads inbox with
    // duplicates of one enquiry.
    const docId = `ads_${createHash('sha256').update(`${productKey}|${email}|${message}`).digest('hex').slice(0, 40)}`
    await adminDb
      .collection('quote_requests')
      .doc(docId)
      .set(
        {
          // No directory listing is involved; /api/leads/mine matches on
          // listing_id, so a null keeps ad enquiries out of owner lead views
          // while /admin/leads (which reads this whole collection) shows them.
          listing_id: null,
          // /admin/leads renders business_name as the row's subject and only
          // links it when listing_id is set, so the product title is what makes
          // an ad enquiry legible there without pretending it has a listing.
          business_name: product.title,
          owner_id: null,
          name: campaignName || email,
          contact: email,
          message: message || null,
          status: 'new',
          gated: false,
          source: 'ads_product_page',
          ad_product: productKey,
          locale,
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    stored = true
  } catch {
    stored = false
  }

  if (stored) {
    // Best effort on top of the stored record — the row is the durable part.
    await sendEmail(
      ADS_INBOX,
      `CityBeat ad enquiry: ${product.shortTitle}`,
      `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="font-weight:900">New advertising enquiry</h2>
        <p><strong>Product:</strong> ${esc(product.title)}<br/>
        <strong>Language:</strong> ${locale === 'es' ? 'Spanish' : 'English'}<br/>
        <strong>Reply to:</strong> ${esc(email)}</p>
        ${campaignName ? `<p><strong>Campaign:</strong> ${esc(campaignName)}</p>` : ''}
        ${notes ? `<p><strong>Notes:</strong><br/>${esc(notes).replace(/\n/g, '<br/>')}</p>` : ''}
        <p style="font-size:11px;color:#999">Sent from the ${esc(product.shortTitle)} page on citybeatmag.co.</p>
      </div>`,
      INQUIRY_FROM
    ).catch(() => {})
  }

  redirect(`${base}?contact=${stored ? 'ok' : 'failed'}`)
}

export default function ProductPage({ params, searchParams }: ProductPageProps) {
  const locale = (params.locale || 'en') as Locale
  const adProducts = getAdProducts(locale)
  const productKey = params.product as AdProductKey
  const product = adProducts[productKey]

  if (!product) {
    notFound()
  }

  const t = locale === 'es' ? formCopy.es : formCopy.en
  const contactState = searchParams?.contact
  const banner =
    contactState === 'ok'
      ? { tone: 'ok' as const, text: t.ok }
      : contactState === 'email'
        ? { tone: 'error' as const, text: t.badEmail }
        : contactState === 'throttled'
          ? { tone: 'error' as const, text: t.throttled }
          : contactState === 'failed'
            ? { tone: 'error' as const, text: t.failed }
            : null

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide grid min-h-[78svh] gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Link href={withLocale(locale, '/ads')} className="text-sm font-black uppercase tracking-wider text-brand-neon hover:underline">
            {t.backToAds}
          </Link>
          <p className="mt-10 text-xs font-black uppercase tracking-[0.3em] text-brand-magenta">{product.shortTitle}</p>
          <h1 className="mt-4 text-balance text-5xl font-black leading-[0.9] text-white md:text-7xl">
            {product.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-white/65">{product.dek}</p>

          <div className="mt-8 flex items-end gap-4">
            <p className="text-6xl font-black text-brand-neon">{product.price}</p>
            <p className="pb-2 text-xs font-black uppercase tracking-[0.24em] text-white/35">{product.cadence}</p>
          </div>

          <ul className="mt-8 grid gap-3">
            {product.features.map((feature) => (
              <li key={feature} className="flex gap-3 text-white/70">
                <span className="mt-1 h-2 w-2 rounded-full bg-brand-neon" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {AD_KEY_TO_SALES_PRODUCT[productKey] && (
            <div className="mt-8">
              <AddToCartButton
                productId={AD_KEY_TO_SALES_PRODUCT[productKey]}
                label={locale === 'es' ? 'Agregar al carrito' : 'Add to cart'}
                inCartLabel={locale === 'es' ? 'En el carrito — ver ✓' : 'In cart — view ✓'}
                className="rounded-md bg-brand-neon px-7 py-4 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
              />
              <p className="mt-3 max-w-md text-sm text-white/45">
                {locale === 'es'
                  ? 'Combínalo con otros productos y paga todo en un solo pago seguro.'
                  : 'Combine it with other products and pay for everything in one secure checkout.'}
              </p>
            </div>
          )}
        </div>

        <div className="citybeat-panel rounded-md p-6">
          <Image
            src={product.image}
            alt=""
            width={1100}
            height={760}
            priority
            className="aspect-[16/10] w-full rounded-md object-cover opacity-80"
          />

          {banner && (
            <p
              role={banner.tone === 'ok' ? 'status' : 'alert'}
              className={`mt-6 rounded-md border px-4 py-3 text-sm ${
                banner.tone === 'ok'
                  ? 'border-brand-neon/40 bg-brand-neon/10 text-brand-neon'
                  : 'border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta'
              }`}
            >
              {banner.text}
            </p>
          )}

          <form action={submitAdInquiry} className="mt-6 grid gap-4">
            <p className="text-sm font-black uppercase tracking-wider text-white/75">{t.heading}</p>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="product" value={productKey} />
            <div>
              <label htmlFor="campaignName" className="text-sm font-bold text-white/75">{t.campaignName}</label>
              <input id="campaignName" name="campaignName" maxLength={140} className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder={t.campaignPlaceholder} />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-bold text-white/75">{t.email}</label>
              <input id="email" name="email" type="email" required maxLength={200} className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="notes" className="text-sm font-bold text-white/75">{t.notes}</label>
              <textarea id="notes" name="notes" rows={4} maxLength={2000} className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder={t.notesPlaceholder} />
            </div>
            <button
              type="submit"
              className="rounded-md bg-brand-neon px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
            >
              {t.submit}
            </button>
            {/* The address stays visible as text: a locked-down desktop or a
                phone with no mail handler still needs a way to reach sales. */}
            <p className="text-xs text-white/45">
              {t.directLine}{' '}
              <a href={`mailto:${ADS_INBOX}`} className="text-brand-neon hover:underline">
                {ADS_INBOX}
              </a>
            </p>
          </form>
        </div>
      </section>
    </CityBeatShell>
  )
}
