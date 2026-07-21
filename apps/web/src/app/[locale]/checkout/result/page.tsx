import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'

type CheckoutResultProps = {
  params: { locale: string }
  searchParams?: { status?: string; billing?: string }
}

export default function CheckoutResultPage({ params, searchParams }: CheckoutResultProps) {
  const locale = params.locale === 'es' ? 'es' : 'en'
  const isEs = locale === 'es'
  const paid = searchParams?.status === 'success'
  const recurring = searchParams?.billing === 'recurring'

  const copy = paid
    ? {
        eyebrow: isEs ? 'Pago confirmado' : 'Payment confirmed',
        title: isEs ? 'Ya est\u00e1 todo listo.' : "You're all set.",
        body: recurring
          ? isEs
            ? 'Stripe proces\u00f3 el primer pago y guard\u00f3 de forma segura el m\u00e9todo de pago para las renovaciones autom\u00e1ticas. Recibir\u00e1s un recibo por correo electr\u00f3nico.'
            : 'Stripe processed the first payment and securely saved the payment method for automatic renewals. A receipt is on its way by email.'
          : isEs
            ? 'Stripe proces\u00f3 tu pago \u00fanico. Recibir\u00e1s un recibo por correo electr\u00f3nico.'
            : 'Stripe processed your one-time payment. A receipt is on its way by email.',
        note: isEs
          ? 'Puedes cerrar esta p\u00e1gina. Tu representante de CityBeat recibir\u00e1 la confirmaci\u00f3n.'
          : 'You can close this page. Your CityBeat representative will receive the confirmation.',
      }
    : {
        eyebrow: isEs ? 'Pago no completado' : 'Payment not completed',
        title: isEs ? 'No se realiz\u00f3 ning\u00fan cargo.' : 'No charge was made.',
        body: isEs
          ? 'Puedes volver a abrir el enlace de pago original cuando est\u00e9s listo o pedirle ayuda a tu representante de CityBeat.'
          : 'You can reopen the original payment link when you are ready, or ask your CityBeat representative for help.',
        note: isEs
          ? 'Tus datos de pago no fueron enviados a CityBeat.'
          : 'Your payment details were not submitted to CityBeat.',
      }

  return (
    <CityBeatShell locale={locale}>
      <main className="container-wide flex min-h-[70vh] items-center justify-center py-16">
        <section className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-brand-charcoal p-7 shadow-2xl sm:p-10">
          <div
            aria-hidden="true"
            className={`absolute inset-x-0 top-0 h-1 ${paid ? 'bg-brand-neon' : 'bg-brand-magenta'}`}
          />
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-black ${
              paid ? 'bg-brand-neon/15 text-brand-neon' : 'bg-brand-magenta/15 text-brand-magenta'
            }`}
            aria-hidden="true"
          >
            {paid ? '\u2713' : '\u2014'}
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-white/45">{copy.eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">{copy.title}</h1>
          <p className="mt-4 text-base leading-7 text-white/70">{copy.body}</p>
          <p className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">{copy.note}</p>
          <Link
            href={withLocale(locale, '/directory')}
            className="mt-7 inline-flex rounded-md border border-white/15 px-4 py-2 text-sm font-black uppercase tracking-wider text-white transition hover:border-brand-neon/50 hover:text-brand-neon"
          >
            {isEs ? 'Ver el directorio' : 'Visit the directory'}
          </Link>
        </section>
      </main>
    </CityBeatShell>
  )
}
