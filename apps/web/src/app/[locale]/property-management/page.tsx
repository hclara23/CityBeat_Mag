import type { Metadata } from 'next'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { publicPropertyCompanies } from '@/lib/property-company-public'
import RegisterCompanyClient from './RegisterCompanyClient'
import { apartmentCompanyId, PROPERTY_TYPES } from '@/lib/apartments'
import { publicApartments } from '@/lib/apartment-public'
import { localeAlternates, normLocale } from '@/lib/seo'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = normLocale((await params).locale)
  return { title: locale === 'es' ? 'Administradoras: una factura, todo su portafolio · CityBeat' : 'Property managers: one bill, your whole portfolio · CityBeat',
    description: locale === 'es' ? 'Promoción para administradoras residenciales y comerciales. $9.99 USD por propiedad al mes mientras la suscripción permanezca activa.' : 'A portfolio promotion for residential and commercial property managers. $9.99 per property per month while your subscription stays active.',
    alternates: localeAlternates(locale, '/property-management') }
}
export default async function PropertyManagementPromotion({ params }: Props) {
  const locale = normLocale((await params).locale), es = locale === 'es'
  const order = ['rpm-living', 'm7-elp', 'integrity-asset-management', 'case-associates', 'haggerty-company']
  const rank = (id: string) => order.includes(id) ? order.indexOf(id) : 999
  const [companyCatalog, communities] = await Promise.all([publicPropertyCompanies(), publicApartments()])
  const companies = companyCatalog.sort((a, b) => rank(a.id) - rank(b.id))
  return <CityBeatShell locale={locale}><div className="citybeat-app min-h-screen pb-20">
    <section className="border-b border-white/10 bg-brand-ink py-10 sm:py-16">
      <div className="container-wide grid items-center gap-12 lg:grid-cols-[1.25fr_.75fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-brand-neon">{es ? 'Para administradoras residenciales y comerciales' : 'For residential & commercial property managers'}</p>
          <h1 className="mt-5 font-display text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">{es ? <>Un portafolio.<br/>Una factura.<br/><span className="text-brand-neon">Más visibilidad local.</span></> : <>One portfolio.<br/>One bill.<br/><span className="text-brand-neon">More local visibility.</span></>}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">{es ? 'Reúna sus propiedades en CityBeat. Edite varias fichas a la vez, delegue cada una a su equipo y conserve el control corporativo.' : 'Bring your properties together on CityBeat. Update multiple listings at once, give each manager the right access, and keep corporate control.'}</p>
          <a href="#companies" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-neon px-7 py-3 font-black text-black hover:bg-white">{es ? 'Buscar y reclamar mi empresa' : 'Find & claim my company'} →</a>
          <p className="mt-4 text-sm text-white/55">{es ? 'Solicitar la verificación es gratis. Pague cuando active su portafolio.' : 'Request verification for free. Pay when you activate your portfolio.'}</p>
        </div>
        <aside className="rounded-3xl border border-brand-neon/50 bg-brand-ink p-7 text-white shadow-xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-[.18em] text-white/70">{es ? 'Promoción para fundadores' : 'Portfolio founders offer'}</p>
          <p className="mt-5 text-xl text-white/60"><s>$19.99</s> <span className="ml-2 rounded-full bg-brand-neon px-3 py-1 text-xs font-black text-black">{es ? 'AHORRE 50%' : 'SAVE 50%'}</span></p>
          <p className="mt-2 text-7xl font-black tracking-tighter text-brand-neon">$9.99</p>
          <p className="mt-2 font-bold">{es ? 'USD / propiedad / mes' : 'USD / property / month'}</p>
          <p className="mt-5 border-t border-white/20 pt-5 leading-6 text-white/70">{es ? 'Tarifa fija mientras mantenga activa su suscripción. Un cobro mensual automático con tarjeta para todo el portafolio inscrito.' : 'Your rate stays locked while your subscription remains active. One automatic monthly card payment for your enrolled portfolio.'}</p>
          <div className="mt-6 rounded-xl bg-white/5 p-4"><p className="text-xs font-bold uppercase text-white/60">{es ? 'Ejemplo: 10 propiedades' : 'Example: 10 properties'}</p><p className="mt-1 text-2xl font-black">$99.90 <span className="text-sm font-medium">{es ? 'USD / mes' : 'USD / month'}</span></p></div>
          <p className="mt-4 text-xs leading-5 text-white/60">{es ? 'Cada ficha inscrita cuenta como una propiedad. Los complejos se facturan por ficha, no por apartamento. Cancele desde Facturación.' : 'Each enrolled listing counts as one property. A complex is billed per listing, not per apartment. Cancel in Billing.'}</p>
        </aside>
      </div>
    </section>
    <section className="container-wide py-12">
      <div className="grid gap-4 md:grid-cols-4">{(es ? [ ['01', 'Reclame su empresa', 'Verificamos su autorización para administrar el portafolio.'], ['02', 'Reúna sus propiedades', 'Revise las fichas existentes y agregue nuevas propiedades.'], ['03', 'Active una sola factura', 'Introduzca su tarjeta de forma segura en Stripe.'], ['04', 'Administre en equipo', 'Edición masiva y un responsable opcional por ficha.'] ] : [ ['01', 'Claim your company', 'We review your authority to manage the portfolio.'], ['02', 'Bring properties together', 'Review existing listings and add new rental properties.'], ['03', 'Start one monthly bill', 'Enter your card securely through Stripe.'], ['04', 'Manage as a team', 'Bulk editing and an optional manager for each listing.'] ]).map(([n, title, text]) => <div key={n} className="rounded-xl border border-white/15 p-5"><span className="text-sm font-black text-brand-neon">{n}</span><h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}</div>
    </section>
    <section id="companies" className="container-wide scroll-mt-24 py-4">
      <p className="text-xs font-black uppercase tracking-[.18em] text-brand-neon">{es ? 'Administradoras de nuestra región' : 'Management companies in our region'}</p>
      <h2 className="mt-3 text-3xl font-black sm:text-4xl">{es ? 'Su portafolio merece estar aquí.' : 'Your portfolio belongs here.'}</h2>
      <p className="mt-4 max-w-3xl leading-7 text-white/65">{es ? 'Explore las empresas y sus comunidades publicadas. Estas fichas informativas no indican que una empresa esté suscrita, haya reclamado su perfil o recomiende CityBeat.' : 'Explore local firms and their published communities. These informational profiles do not mean a company subscribes, has claimed its profile, or endorses CityBeat.'}</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{companies.map(company => {
        const count = communities.filter(p => apartmentCompanyId(p) === company.id).length
        return <Link key={company.id} href={`/${locale}/property-management/${company.id}`} className="group flex min-h-64 flex-col rounded-2xl border border-white/15 bg-brand-ink p-6 transition-colors hover:border-brand-neon focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">
          <p className="text-xs font-bold uppercase tracking-wider text-white/45">{company.region}</p>
          <h3 className="mt-3 text-2xl font-black group-hover:text-brand-neon">{company.name}</h3>
          {company.aliases.length > 0 && <p className="mt-2 text-sm text-white/55">{company.aliases.join(' · ')}</p>}
          <p className="mt-5 text-lg font-bold">{count ? `${count} ${es ? 'ubicaciones publicadas' : 'published locations'}` : es ? 'Portafolio por confirmar' : 'Portfolio awaiting confirmation'}</p>
          <p className="mt-2 text-sm leading-6 text-white/60">{company.inventoryNote[locale]}</p>
          <span className="mt-auto pt-6 font-black text-brand-neon">{es ? 'Ver portafolio y reclamar' : 'View portfolio & claim'} →</span>
        </Link>
      })}</div>
      <p className="mt-6 text-sm text-white/60">{es ? '¿No aparece su empresa?' : 'Don’t see your company?'} <Link href="#new-company" className="font-bold text-brand-neon underline">{es ? 'Solicite su perfil corporativo' : 'Request a company profile'}</Link></p>
    </section>
    <section className="container-wide mt-12"><div className="rounded-2xl border border-white/15 bg-brand-ink p-6 sm:p-9">
      <h2 className="text-2xl font-black">{es ? 'Un lugar para cada tipo de alquiler' : 'A place for every kind of rental'}</h2>
      <p className="mt-3 max-w-3xl leading-7 text-white/65">{es ? 'Desde su portafolio, seleccione Nueva propiedad y el tipo de inmueble. Las nuevas fichas se revisan antes de activar su publicación de pago. Antes de ampliar una suscripción verá el cargo proporcional y el nuevo total mensual.' : 'Choose New property in your portfolio and select the rental type. New listings are reviewed before paid publication. Before expanding an active subscription, you’ll see the prorated charge and your new monthly total.'}</p>
      <div className="mt-6 flex flex-wrap gap-2">{Object.entries(PROPERTY_TYPES).map(([key, label]) => <span key={key} className="rounded-full border border-white/20 px-4 py-2 text-sm">{label[locale]}</span>)}</div>
      <p className="mt-6 text-sm text-white/55">{es ? 'El catálogo inicial se enfoca en comunidades de apartamentos. Sus fichas y herramientas de administración están disponibles en inglés y español.' : 'Our initial researched catalog focuses on apartment communities. Listings and management tools are available in English and Spanish.'}</p>
    </div></section>
    <RegisterCompanyClient locale={locale}/>
  </div></CityBeatShell>
}
