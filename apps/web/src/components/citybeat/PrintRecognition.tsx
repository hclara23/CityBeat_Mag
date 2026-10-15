import Image from 'next/image'
import { PRINT_LABELS, publicPrintRecognition } from '@/lib/print-recognition'

export function PrintBadges({ value, locale }: { value: unknown; locale: 'en' | 'es' }) {
  const entries = publicPrintRecognition(value)
  const types = [...new Set(entries.map(entry => entry.type))]
  if (!types.length) return null
  return <div className="flex flex-wrap gap-2" aria-label={locale === 'es' ? 'Apariciones en la revista impresa' : 'Print magazine appearances'}>
    {types.map(type => <span key={type} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${type === 'cover' ? 'border-brand-gold bg-brand-gold text-black' : type === 'editorial' ? 'border-brand-neon/40 bg-brand-neon/10 text-brand-neon' : 'border-white/25 bg-white/5 text-white/70'}`}>
      <span aria-hidden="true">{type === 'cover' ? '★' : type === 'editorial' ? '▤' : '◇'}</span>{PRINT_LABELS[type][locale]}
    </span>)}
  </div>
}

export function PrintRecognitionPanel({ value, locale }: { value: unknown; locale: 'en' | 'es' }) {
  const entries = publicPrintRecognition(value)
  if (!entries.length) return null
  const es = locale === 'es'
  return <section className="citybeat-panel rounded-2xl border border-brand-gold/30 p-6 sm:p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">CityBeat Magazine · {es ? 'Edición impresa' : 'In print'}</p>
    <h2 className="mt-2 mb-5 font-display text-2xl font-black uppercase">{es ? 'En las páginas de CityBeat' : 'In the pages of CityBeat'}</h2>
    <PrintBadges value={entries} locale={locale} />
    <div className="mt-6 space-y-8">{entries.map(entry => <article key={entry.id} className="flex flex-col gap-5 sm:flex-row">
      {entry.image_url && <a href={entry.image_url} target="_blank" rel="noopener noreferrer" className="w-full shrink-0 sm:w-48" aria-label={es ? 'Abrir imagen de la edición impresa' : 'Open print issue artwork'}>
        <Image src={entry.image_url} alt={`${PRINT_LABELS[entry.type][locale]} — ${es ? entry.issue_es : entry.issue}`} width={640} height={810} sizes="(max-width: 640px) 90vw, 192px" className="h-auto w-full rounded-lg border border-white/10 object-contain" />
      </a>}
      <div><h3 className="font-display text-xl font-bold">{PRINT_LABELS[entry.type][locale]}</h3>
        <p className="mt-1 text-sm text-brand-gold">{es ? entry.issue_es : entry.issue}</p>
        {entry.title && <p className="mt-3 text-white/80">{es ? entry.title_es || entry.title : entry.title}</p>}
        <p className="mt-3 text-xs leading-relaxed text-white/55">{entry.type === 'advertisement'
          ? (es ? 'Aparición publicitaria; no es una recomendación editorial.' : 'Advertising placement, not an editorial endorsement.')
          : (es ? 'Aparición en una edición impresa, registrada por CityBeat.' : 'Print appearance recorded by CityBeat.')}</p>
        {entry.image_url && <p className="mt-2 text-xs leading-relaxed text-white/55">{es ? 'Imagen histórica de la publicación. El personal y los servicios pueden haber cambiado desde su impresión.' : 'Historical publication artwork. Staff and services may have changed since printing.'}</p>}
        {entry.issue_url && <a className="mt-4 inline-block text-sm font-bold text-brand-neon underline" href={entry.issue_url} target="_blank" rel="noopener noreferrer">{es ? 'Ver edición' : 'View issue'} ↗</a>}
      </div>
    </article>)}</div>
  </section>
}
