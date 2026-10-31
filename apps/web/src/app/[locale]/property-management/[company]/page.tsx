import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { publicPropertyCompany, publicPropertyCompanies } from '@/lib/property-company-public'
import { apartmentCompanyId, communityTypeLabel } from '@/lib/apartments'
import { publicApartments } from '@/lib/apartment-public'
import { localeAlternates, normLocale } from '@/lib/seo'
import PortfolioClient from './PortfolioClient'

export const dynamic = 'force-dynamic'
type Props = { params: Promise<{ locale: string; company: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, company: id } = await params, company = await publicPropertyCompany(id)
  return company ? { title: `${company.name} · CityBeat ${locale === 'es' ? 'Portafolio' : 'Property portfolio'}`, alternates: localeAlternates(locale, `/property-management/${id}`) } : {}
}
export default async function CompanyPortfolio({ params }: Props) {
  const { locale: requested, company: id } = await params, locale = normLocale(requested), es = locale === 'es'
  const company = await publicPropertyCompany(id)
  if (!company) notFound()
  const properties = (await publicApartments()).filter(p => apartmentCompanyId(p) === id)
  const companies = await publicPropertyCompanies()
  return <CityBeatShell locale={locale}><div className="citybeat-app container-wide py-8 sm:py-12">
    <Link href={`/${locale}/property-management`} className="inline-flex min-h-11 items-center font-bold text-brand-neon">← {es ? 'Promoción y todas las administradoras' : 'The offer & all management companies'}</Link>
    <nav aria-label={es ? 'Otras administradoras' : 'Other management companies'} className="mt-3 flex flex-wrap gap-2">{companies.filter(c => c.id !== id).slice(0, 8).map(c => <Link key={c.id} href={`/${locale}/property-management/${c.id}`} className="rounded-full border border-white/20 px-3 py-2 text-xs text-white/65 hover:text-brand-neon">{c.name}</Link>)}</nav>
    <header className="mt-8 grid gap-6 rounded-2xl border border-white/15 bg-brand-ink p-6 sm:p-9 lg:grid-cols-[1fr_auto]">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-brand-neon">{es ? 'Portafolio de propiedades' : 'Property portfolio'} · {company.region}</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">{company.name}</h1><p className="mt-3 text-white/60">{company.aliases.join(' · ')}</p><p className="mt-5 max-w-2xl leading-7 text-white/70">{company.inventoryNote[locale]}</p></div>
      <div className="rounded-xl border border-brand-neon/40 p-5 lg:max-w-80"><p className="text-xs font-black uppercase tracking-wider text-brand-neon">{es ? 'Promoción por volumen para administradoras' : 'Management-company multi-property offer'}</p><p className="mt-4 text-sm text-white/70">{es ? 'Precio regular' : 'Regular price'} <s>$19.99</s> {es ? 'USD por propiedad / mes' : 'USD per property / month'}</p><p className="mt-2 text-4xl font-black text-brand-neon">$9.99</p><p className="mt-2 font-bold">{es ? 'USD por propiedad / mes' : 'USD per property / month'}</p><p className="mt-3 inline-block rounded-full bg-brand-neon px-3 py-1 text-xs font-black text-black">{es ? 'AHORRE 50%' : 'SAVE 50%'}</p><p className="mt-3 text-sm leading-6 text-white/80">{es ? 'Su empresa recibe esta tarifa especial por inscribir varias propiedades juntas bajo una cuenta corporativa.' : 'Your management company receives this special rate for enrolling multiple properties together under one corporate account.'}</p><p className="mt-3 text-sm leading-6 text-white/60">{es ? 'Una factura corporativa. Tarifa fija mientras la suscripción permanezca activa.' : 'One corporate bill. Rate locked while your subscription stays active.'}</p><a href="#portfolio" className="mt-5 flex min-h-12 items-center justify-center rounded-lg bg-brand-neon px-4 font-black text-black">{es ? 'Reclamar / Administrar' : 'Claim / Manage'} →</a></div>
    </header>
    <PortfolioClient companyId={id} companyName={company.name} locale={locale}/>
    <section className="mt-12"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-2xl font-black">{es ? 'Propiedades en el directorio' : 'Properties in the directory'} {properties.length > 0 && <span className="text-white/45">({properties.length})</span>}</h2><a href={company.portfolioSource} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-neon underline">{es ? 'Consultar fuente oficial' : 'View official source'} ↗</a></div>
      <p className="mt-3 text-sm leading-6 text-white/55">{es ? 'La administración compartida no implica un mismo propietario. El catálogo público no representa necesariamente todo el portafolio ni confirma una suscripción a CityBeat.' : 'Shared management does not establish common ownership. This public catalog may not represent the entire portfolio and does not confirm a CityBeat subscription.'}</p>
      {properties.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{properties.map(p => <Link key={p.slug} href={`/${locale}/apartments/${p.slug}`} className="rounded-xl border border-white/15 bg-brand-ink p-5 hover:border-brand-neon"><p className="text-xs font-bold uppercase text-brand-neon">{communityTypeLabel(p.type, locale)}</p><h3 className="mt-3 text-xl font-black">{p.name}</h3><p className="mt-3 text-sm leading-6 text-white/60">{p.address}<br/>{p.city || 'El Paso'}, {p.state || 'TX'} {p.zip}</p><p className="mt-4 text-sm font-bold">{es ? 'Ver ficha' : 'View listing'} →</p></Link>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-white/25 p-6 text-white/65">{es ? 'Aún no hemos confirmado una lista pública de comunidades. Reclame su empresa para verificar su autorización y agregar las propiedades que administra.' : 'We haven’t confirmed a public community roster yet. Claim your company to verify your authority and add the properties you manage.'}</div>}
    </section>
  </div></CityBeatShell>
}
