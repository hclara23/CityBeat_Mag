'use client'

import { useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

export interface ReferralProgramSummary {
  listing_id: string
  listing_name: string
  plan: string | null
  code: string
  referral_path: string
  pending_referrals: number
  qualified_referrals: number
  qualified_this_year: number
  annual_cap: number
  discount_months_remaining: number
  discount_status: string
}

export function ReferralProgramCard({
  programs,
}: {
  programs: ReferralProgramSummary[]
}) {
  const locale = useLocale() === 'es' ? 'es' : 'en'
  const isEs = locale === 'es'
  const [copied, setCopied] = useState('')

  if (programs.length === 0) return null

  const referralUrl = (program: ReferralProgramSummary) => {
    const path = `/${locale}${program.referral_path}`
    return typeof window === 'undefined' ? path : `${window.location.origin}${path}`
  }

  const copy = async (program: ReferralProgramSummary) => {
    await navigator.clipboard.writeText(referralUrl(program))
    setCopied(program.listing_id)
    window.setTimeout(() => setCopied(''), 1800)
  }

  const share = async (program: ReferralProgramSummary) => {
    const url = referralUrl(program)
    if (navigator.share) {
      await navigator.share({
        title: 'CityBeat Directory',
        text: isEs
          ? 'Únete al directorio de negocios de CityBeat con mi enlace.'
          : 'Join the CityBeat business directory with my referral link.',
        url,
      })
      return
    }
    await copy(program)
  }

  return (
    <section className="mb-12 overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-amber-50 shadow-sm">
      <div className="border-b border-cyan-100 px-6 py-5 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">
          {isEs ? 'Programa de referidos' : 'Referral program'}
        </p>
        <h2 className="mt-1 text-2xl font-black text-gray-950">
          {isEs ? 'Refiere un negocio. Ahorra 25%.' : 'Refer a business. Save 25%.'}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          {isEs
            ? 'Cuando un negocio se registra con tu enlace y permanece activo durante tres meses, recibes tres meses con 25% de descuento. Hasta 16 referidos calificados por año.'
            : 'When a business signs up through your link and stays active for three months, you earn three months at 25% off. Up to 16 qualified referrals per year.'}
        </p>
      </div>

      <div className="grid gap-5 p-6 sm:p-8">
        {programs.map((program) => {
          const annualPercent = Math.min(
            100,
            Number(((program.discount_months_remaining * 25) / 12).toFixed(2))
          )
          return (
            <article key={program.listing_id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-950">{program.listing_name}</h3>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-gray-500">
                    {program.plan || (isEs ? 'Ficha pagada' : 'Paid listing')} · {program.code}
                  </p>
                </div>
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800">
                  {program.qualified_this_year}/{program.annual_cap} {isEs ? 'este año' : 'this year'}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-700">
                  {referralUrl(program)}
                </div>
                <button
                  type="button"
                  onClick={() => copy(program)}
                  className="rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
                >
                  {copied === program.listing_id
                    ? isEs ? 'Copiado' : 'Copied'
                    : isEs ? 'Copiar enlace' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={() => share(program)}
                  className="rounded-lg border border-cyan-300 px-4 py-2.5 text-sm font-bold text-cyan-800 transition hover:bg-cyan-50"
                >
                  {isEs ? 'Compartir' : 'Share'}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={isEs ? 'Pendientes' : 'Pending'} value={program.pending_referrals} />
                <Stat label={isEs ? 'Calificados' : 'Qualified'} value={program.qualified_referrals} />
                <Stat
                  label={isEs ? 'Meses de descuento' : 'Discount months'}
                  value={program.discount_months_remaining}
                />
                <Stat
                  label={isEs ? 'Valor anual próximo' : 'Next annual value'}
                  value={`${annualPercent}%`}
                />
              </div>

              {program.discount_status === 'blocked_existing_discount' && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {isEs
                    ? 'Tus recompensas están guardadas y se aplicarán cuando termine tu promoción actual.'
                    : 'Your rewards are saved and will apply after your current promotion ends.'}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-black text-gray-950">{value}</p>
    </div>
  )
}
