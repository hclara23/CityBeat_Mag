'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { APARTMENT_COMMUNITIES, APARTMENT_MANAGER, APARTMENT_SOURCE, APARTMENT_VERIFIED, apartmentPhone, communityTypeLabel, searchApartments, type ApartmentLocale } from '@/lib/apartments'

const zipCodes = [...new Set(APARTMENT_COMMUNITIES.map(community => community.zip))].sort()

export default function ApartmentsClient({ locale }: { locale: ApartmentLocale }) {
  const es = locale === 'es'
  const [query, setQuery] = useState('')
  const [zip, setZip] = useState('')
  const [type, setType] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const readFilters = () => {
      const params = new URLSearchParams(window.location.search)
      setQuery((params.get('q') || '').slice(0, 100))
      const requestedZip = params.get('zip') || ''
      setZip(zipCodes.includes(requestedZip) ? requestedZip : '')
      const requestedType = params.get('type') || ''
      setType(['apartments', 'rental-homes'].includes(requestedType) ? requestedType : '')
      setReady(true)
    }
    readFilters()
    window.addEventListener('popstate', readFilters)
    return () => window.removeEventListener('popstate', readFilters)
  }, [])
  useEffect(() => {
    if (!ready) return
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries({ q: query, zip, type })) {
      if (value) url.searchParams.set(key, value)
      else url.searchParams.delete(key)
    }
    window.history.replaceState(window.history.state, '', url)
  }, [query, zip, type, ready])
  const communities = searchApartments(query, zip, type)
  const reset = () => { setQuery(''); setZip(''); setType('') }
  return <CityBeatShell locale={locale}>
    <div className="citybeat-app min-h-screen pb-24">
      <section className="border-b border-white/10 bg-[#080d13] py-7 sm:py-10">
        <div className="container-wide">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/12 bg-white text-slate-950 shadow-[0_25px_80px_rgba(0,0,0,.32)]">
            <div className="grid lg:grid-cols-[.86fr_1.14fr]">
              <div className="relative overflow-hidden bg-[#0a1723] p-5 text-white sm:p-10 lg:p-12">
                <div className="absolute inset-0 opacity-30 citybeat-grid" />
                <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-brand-neon/20 blur-3xl" />
                <div className="relative z-10">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">{es ? 'Tu próxima dirección' : 'Your next address'}</p>
                  <h1 className="mt-3 font-display text-3xl font-black uppercase leading-tight tracking-[-.03em] sm:text-5xl lg:text-6xl">{es ? 'Apartamentos en El Paso' : 'El Paso apartments'}</h1>
                  <p className="mt-6 text-base leading-7 text-white/75">{es ? 'Explora comunidades, compara sus características y contacta directamente al equipo de arrendamiento.' : 'Explore communities, compare their features and connect directly with the leasing team.'}</p>
                  <div className="mt-8 flex flex-wrap gap-3 text-xs font-black uppercase tracking-wider">
                    <span className="rounded-full border border-brand-neon/45 bg-brand-neon/10 px-4 py-2 text-brand-neon">El Paso</span>
                    <Link href={`/${locale}/directory`} className="rounded-full border border-white/25 px-4 py-2 hover:border-brand-neon hover:text-brand-neon">{es ? 'Directorio de negocios' : 'Business directory'} →</Link>
                  </div>
                </div>
              </div>
              <div className="directory-search-light p-6 sm:p-9 lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">{es ? 'Guía local CityBeat' : 'CityBeat local guide'}</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">{es ? 'Encuentra una comunidad' : 'Find a community'}</h2>
                <label className="mt-6 block text-sm font-bold text-slate-800">
                  {es ? 'Nombre, dirección o amenidad' : 'Name, address or amenity'}
                  <input type="search" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} placeholder={es ? 'Busca ALZA, alberca, gimnasio…' : 'Try ALZA, pool, fitness…'} className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 placeholder:text-slate-500 focus:border-cyan-600 focus:ring-cyan-600" />
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-800">{es ? 'Código postal' : 'ZIP code'}
                    <select value={zip} onChange={e => setZip(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-base text-slate-950 focus:border-cyan-600 focus:ring-cyan-600"><option value="">{es ? 'Todas las zonas' : 'All areas'}</option>{zipCodes.map(value => <option key={value} value={value}>{value}</option>)}</select>
                  </label>
                  <label className="text-sm font-bold text-slate-800">{es ? 'Tipo de vivienda' : 'Community type'}
                    <select value={type} onChange={e => setType(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-base text-slate-950 focus:border-cyan-600 focus:ring-cyan-600"><option value="">{es ? 'Todas las comunidades' : 'All communities'}</option><option value="apartments">{es ? 'Apartamentos' : 'Apartments'}</option><option value="rental-homes">{es ? 'Casas de renta' : 'Rental homes'}</option></select>
                  </label>
                </div>
                {(query || zip || type) && <button onClick={reset} className="mt-3 min-h-11 text-sm font-bold text-cyan-700 hover:text-cyan-900">{es ? 'Quitar filtros' : 'Clear filters'}</button>}
                <p className="mt-6 text-sm leading-6 text-slate-600">{es ? 'Incluye las 10 comunidades de El Paso publicadas por RPM Living: nueve de apartamentos y una de casas de renta.' : 'Includes the 10 El Paso communities published by RPM Living: nine apartment communities and one rental-home community.'}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="container-wide mt-8" aria-label={es ? 'Resultados de comunidades' : 'Community results'}>
        <p role="status" className="mb-6 text-sm text-white/75">{communities.length} {es ? 'comunidades encontradas' : 'communities found'}</p>
        {communities.length === 0 ? <div className="citybeat-panel rounded-2xl p-10 text-center"><p>{es ? 'No se encontraron comunidades con estos filtros.' : 'No communities match these filters.'}</p><button onClick={reset} className="mt-4 min-h-11 rounded border border-brand-neon px-5 text-brand-neon">{es ? 'Quitar filtros' : 'Clear filters'}</button></div> : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {communities.map(community => <article key={community.slug} className="group flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-brand-ink/90 transition hover:border-brand-neon/60">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-brand-charcoal p-6"><span className="text-xs font-bold uppercase tracking-wider text-brand-neon">{communityTypeLabel(community.type, locale)}</span><span className="text-sm text-white/60">{community.zip}</span></div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-2xl font-extrabold leading-snug text-white"><Link href={`/${locale}/apartments/${community.slug}`} className="hover:text-brand-neon">{community.name}</Link></h2>
              <p className="mt-2 text-xs text-white/60">{es ? 'Administración' : 'Managed by'}: {APARTMENT_MANAGER}</p>
              <p className="mt-4 flex-1 text-sm leading-6 text-white/70">{community.summary[locale]}</p>
              <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/65">{community.address}<br />El Paso, TX {community.zip}</p>
              <a href={`tel:+1${community.phone}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-brand-neon">{apartmentPhone(community.phone)}</a>
              <Link href={`/${locale}/apartments/${community.slug}`} className="mt-3 block rounded bg-brand-neon px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-black hover:bg-white">{es ? 'Ver detalles' : 'View details'} →</Link>
            </div>
          </article>)}
        </div>}
        <div className="mt-10 border-t border-white/10 pt-6 text-sm leading-6 text-white/60">
          <p>{es ? 'Administración compartida no implica el mismo propietario. CityBeat es un directorio independiente; confirma precios, disponibilidad y políticas con cada comunidad.' : 'Shared management does not imply common ownership. CityBeat is an independent directory; confirm pricing, availability and policies with each community.'}</p>
          <p className="mt-2"><a href={APARTMENT_SOURCE} target="_blank" rel="noopener noreferrer" className="text-brand-neon underline">{es ? 'Fuente: directorio oficial de RPM Living' : 'Source: RPM Living official directory'}</a> · {es ? 'Datos revisados' : 'Records checked'}: {APARTMENT_VERIFIED}</p>
        </div>
      </section>
    </div>
  </CityBeatShell>
}
