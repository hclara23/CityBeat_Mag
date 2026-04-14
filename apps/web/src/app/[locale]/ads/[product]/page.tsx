import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { adProducts, withLocale } from '@/components/citybeat/content'
import type { AdProductKey } from '@/components/citybeat/content'

const productKeys = Object.keys(adProducts) as AdProductKey[]

type ProductPageProps = {
  params: {
    locale: string
    product: string
  }
}

export function generateStaticParams() {
  return ['en', 'es'].flatMap((locale) =>
    productKeys.map((product) => ({ locale, product }))
  )
}

export default function ProductPage({ params }: ProductPageProps) {
  const locale = params.locale || 'en'
  const productKey = params.product as AdProductKey
  const product = adProducts[productKey]

  if (!product) {
    notFound()
  }

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide grid min-h-[78svh] gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <Link href={withLocale(locale, '/ads')} className="text-sm font-black uppercase tracking-wider text-brand-neon hover:underline">
            Back to ads
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
          <form className="mt-6 grid gap-4">
            <div>
              <label htmlFor="campaignName" className="text-sm font-bold text-white/75">Campaign name</label>
              <input id="campaignName" name="campaignName" className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder="Spring launch" />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-bold text-white/75">Email</label>
              <input id="email" name="email" type="email" className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="notes" className="text-sm font-bold text-white/75">Campaign notes</label>
              <textarea id="notes" name="notes" rows={4} className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon" placeholder="Audience, timing, creative needs" />
            </div>
            <a
              href={`mailto:ads@citybeatmag.co?subject=${encodeURIComponent(product.title)}%20campaign`}
              className="rounded-md bg-brand-neon px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300"
            >
              Contact Sales
            </a>
          </form>
        </div>
      </section>
    </CityBeatShell>
  )
}
