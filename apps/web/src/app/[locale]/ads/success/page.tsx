import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'

type SuccessPageProps = {
  params: {
    locale: string
  }
}

export default function SuccessPage({ params }: SuccessPageProps) {
  const locale = params.locale || 'en'
  const isEs = locale === 'es'

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide grid min-h-[70svh] place-items-center py-16">
        <div className="citybeat-panel max-w-2xl rounded-md p-10 text-center">
          <p className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-neon text-3xl font-black text-black">✓</p>
          <h1 className="mt-6 text-4xl font-black text-white">{isEs ? 'Campaña recibida' : 'Campaign received'}</h1>
          <p className="mt-4 text-white/60">
            {isEs
              ? 'Tu campaña fue enviada. Recibirás un correo de confirmación después de la revisión.'
              : 'The campaign has been submitted. You will receive a confirmation email after review.'}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={withLocale(locale, '/ads/campaigns')} className="rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
              {isEs ? 'Ver campañas' : 'View Campaigns'}
            </Link>
            <Link href={withLocale(locale, '/ads')} className="rounded-md border border-white/20 px-5 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:border-brand-neon/50 hover:text-brand-neon">
              {isEs ? 'Volver a Anuncios' : 'Back To Ads'}
            </Link>
          </div>
        </div>
      </section>
    </CityBeatShell>
  )
}
