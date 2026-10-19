import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { type Locale, withLocale } from '@/components/citybeat/content'
import { getSportsUpdates } from '@/lib/sports'
import { getPublishedArticles } from '@/lib/articles'
import { localeAlternates } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  return { title: params.locale === 'es' ? 'Deportes de El Paso · CityBeat' : 'El Paso Sports · CityBeat', alternates: localeAlternates(params.locale, '/sports') }
}
export default async function SportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale = (params.locale === 'es' ? 'es' : 'en') as Locale
  const es = locale === 'es'
  let unavailable = false
  const [updates, articles] = await Promise.all([
    getSportsUpdates().catch(() => { unavailable = true; return [] }),
    getPublishedArticles({ category: 'sports', limit: 20 }),
  ])
  return <CityBeatShell locale={locale}><main className="container-wide py-16">
    <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">CityBeat • El Paso</p>
    <h1 className="mt-3 font-display text-5xl font-black text-white">{es ? 'Deportes' : 'Sports'}</h1>
    <p className="mt-4 max-w-2xl text-white/70">{es ? 'Historias de nuestra comunidad y actualizaciones de colaboradores autorizados. Cada publicación identifica su fuente.' : 'Community reporting and updates from authorized contributors. Every update identifies its source.'}</p>
    <Link href={withLocale(locale, '/contribute')} className="mt-6 inline-block rounded bg-brand-neon px-5 py-3 font-bold text-black">{es ? 'Envía una historia deportiva' : 'Submit a sports story'}</Link>
    {unavailable && <p role="status" className="mt-10 text-white/70">{es ? 'Las actualizaciones no están disponibles temporalmente.' : 'Updates are temporarily unavailable. Please try again shortly.'}</p>}
    {!unavailable && !updates.length && !articles.length && <div className="mt-12 rounded-xl border border-white/15 p-8"><h2 className="text-2xl font-bold text-white">{es ? 'Estamos abriendo la mesa de deportes' : 'The sports desk is open'}</h2><p className="mt-3 text-white/65">{es ? 'Buscamos historias originales, resultados verificados y colaboradores autorizados. No mostramos noticias inventadas ni contenido copiado sin permiso.' : 'We’re welcoming original reporting, verified results and authorized team updates. Stories will appear here as they are published.'}</p></div>}
    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      {articles.map(article => <article key={article._id} className="rounded-xl border border-white/15 p-6"><p className="text-sm text-brand-neon">CityBeat</p><h2 className="mt-2 text-2xl font-bold text-white"><Link href={withLocale(locale, `/stories/${article.slug}`)}>{es ? article.titleES : article.title}</Link></h2><p className="mt-3 text-white/70">{es ? article.excerptES : article.excerpt}</p></article>)}
      {updates.map(update => <article key={update.id} id={update.id} className="rounded-xl border border-white/15 p-6"><p className="text-sm text-brand-neon">{update.source_name} • {es ? 'Actualización del colaborador' : 'Contributor update'}</p><h2 className="mt-2 text-2xl font-bold text-white">{update.title}</h2><p className="mt-2 text-sm text-white/50">{update.author} · <time dateTime={update.published_at}>{new Date(update.published_at).toLocaleDateString(es ? 'es-US' : 'en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', year: 'numeric' })}</time></p><p className="mt-4 whitespace-pre-wrap text-white/75">{update.body}</p>{update.source_url && <a href={update.source_url} rel="noopener noreferrer" target="_blank" className="mt-4 inline-block text-brand-neon underline">{es ? 'Fuente original' : 'Original source'}</a>}</article>)}
    </div>
  </main></CityBeatShell>
}
