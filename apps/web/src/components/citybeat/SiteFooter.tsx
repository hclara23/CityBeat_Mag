import Link from 'next/link'
import { withLocale } from './content'

export function SiteFooter({ locale = 'en' }: { locale?: string }) {
  return (
    <footer className="border-t border-white/10 bg-brand-charcoal/80 py-14">
      <div className="container-wide">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href={`/${locale}`} className="font-display text-3xl font-black tracking-tighter text-white">
              city<span className="italic text-brand-neon">BEat</span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/55">
              {locale === 'es'
                ? 'Cultura local, negocios, comida, eventos e historias fronterizas en inglés y español.'
                : 'Local culture, business, food, events, and borderland stories in English and Spanish.'}
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">
              {locale === 'es' ? 'Lectura' : 'Read'}
            </h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href={withLocale(locale, '/briefs')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Boletines' : 'Briefs'}
              </Link>
              <Link href={withLocale(locale, '/#events')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Eventos' : 'Events'}
              </Link>
              <Link href={withLocale(locale, '/#directory')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Directorio' : 'Directory'}
              </Link>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">
              {locale === 'es' ? 'Trabaja con nosotros' : 'Work With Us'}
            </h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href={withLocale(locale, '/ads')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Anunciar' : 'Advertise'}
              </Link>
              <Link href={withLocale(locale, '/ads/campaigns')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Campañas' : 'Campaigns'}
              </Link>
              <a href="mailto:ads@citybeatmag.co" className="hover:text-brand-neon">
                ads@citybeatmag.co
              </a>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">
              {locale === 'es' ? 'Acceso' : 'Access'}
            </h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href={withLocale(locale, '/login')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Escritores y Editores' : 'Writers & Editors'}
              </Link>
              <Link href={withLocale(locale, '/privacy')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Privacidad' : 'Privacy'}
              </Link>
              <Link href={withLocale(locale, '/terms')} className="hover:text-brand-neon">
                {locale === 'es' ? 'Términos' : 'Terms'}
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs uppercase tracking-[0.22em] text-white/35">
          {locale === 'es'
            ? `Copyright ${new Date().getFullYear()} CityBeat Media Group. Todos los derechos reservados.`
            : `Copyright ${new Date().getFullYear()} CityBeat Media Group`}
        </div>
      </div>
    </footer>
  )
}
