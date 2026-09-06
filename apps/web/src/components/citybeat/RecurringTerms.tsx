import Link from 'next/link'
import { billingTerms, billingTermsShort } from '@/lib/billing-terms'

// Disclosure shown BEFORE a customer starts a subscription. Deliberately not a
// modal, a collapsed accordion, or grey-on-grey fine print: the point is that
// someone actually reads that the price repeats, so it sits under the amount at
// the size of ordinary body copy.

export function RecurringTerms({
  locale,
  interval = 'month',
  variant = 'full',
  className = '',
}: {
  locale: string | undefined
  interval?: 'month' | 'year'
  variant?: 'full' | 'short'
  className?: string
}) {
  const isEs = locale === 'es'

  if (variant === 'short') {
    return (
      <p className={`text-[11px] leading-relaxed text-white/60 ${className}`}>
        {billingTermsShort(locale, interval)}
      </p>
    )
  }

  const t = billingTerms(locale)
  return (
    <div className={`rounded-lg border border-white/10 bg-black/20 p-4 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
        {isEs ? 'Antes de pagar' : 'Before you pay'}
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/70">
        <li>{t.renewal}</li>
        <li>{t.cancel}</li>
        <li>{t.whatHappens}</li>
        <li>{t.refunds}</li>
      </ul>
      <p className="mt-3 text-[11px] text-white/40">
        <Link href={`/${isEs ? 'es' : 'en'}/terms`} className="underline hover:text-white/70">
          {isEs ? 'Términos de Servicio' : 'Terms of Service'}
        </Link>
      </p>
    </div>
  )
}
