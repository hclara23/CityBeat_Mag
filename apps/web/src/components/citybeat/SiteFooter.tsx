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
              Local culture, business, food, events, and borderland stories in English and Spanish.
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">Read</h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href={withLocale(locale, '/briefs')} className="hover:text-brand-neon">Briefs</Link>
              <Link href={withLocale(locale, '/#events')} className="hover:text-brand-neon">Events</Link>
              <Link href={withLocale(locale, '/#directory')} className="hover:text-brand-neon">Directory</Link>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">Work With Us</h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href={withLocale(locale, '/ads')} className="hover:text-brand-neon">Advertise</Link>
              <Link href={withLocale(locale, '/ads/campaigns')} className="hover:text-brand-neon">Campaigns</Link>
              <a href="mailto:ads@citybeatmag.co" className="hover:text-brand-neon">ads@citybeatmag.co</a>
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-white">Access</h3>
            <div className="grid gap-3 text-sm text-white/55">
              <Link href="/studio" className="hover:text-brand-neon">Studio</Link>
              <Link href={withLocale(locale, '/privacy')} className="hover:text-brand-neon">Privacy</Link>
              <Link href={withLocale(locale, '/terms')} className="hover:text-brand-neon">Terms</Link>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs uppercase tracking-[0.22em] text-white/35">
          Copyright {new Date().getFullYear()} CityBeat Media Group
        </div>
      </div>
    </footer>
  )
}
