import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { jsonLdSafe } from '@/lib/jsonld'
import { localeAlternates, breadcrumbJsonLd } from '@/lib/seo'

// ISR: cache the rendered page for 15 min (was force-dynamic, defeating this).
export const revalidate = 900

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

type Params = { locale: string; id: string }

interface Job {
  id: string
  title: string
  company_name: string
  location: string
  description: string
  apply_url?: string | null
  created_at?: string | null
  expires_at?: string | null
  is_paid?: boolean
}

// Only a currently-active, paid job has its own indexable page. An expired or
// unpaid job 404s so we never serve (or ask Google to index) a dead posting.
const getJob = cache(async (id: string): Promise<Job | null> => {
  try {
    const doc = await adminDb.collection('jobs').doc(id).get()
    if (!doc.exists) return null
    const j = { id: doc.id, ...(doc.data() as any) } as Job
    if (!j.is_paid) return null
    if (j.expires_at && j.expires_at <= new Date().toISOString()) return null
    return j
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const job = await getJob(params.id)
  if (!job) return { title: 'Job not found · CityBeat', robots: { index: false, follow: true } }
  const isEs = params.locale === 'es'
  const where = job.location ? ` in ${job.location}` : ''
  const title = `${job.title} at ${job.company_name}${where} · CityBeat Jobs`
  const description =
    (typeof job.description === 'string' && job.description.trim().slice(0, 155)) ||
    (isEs
      ? `${job.title} en ${job.company_name}. Postúlate a este empleo local en El Paso vía CityBeat.`
      : `${job.title} at ${job.company_name}. Apply to this local El Paso job on CityBeat.`)
  return {
    title,
    description,
    alternates: localeAlternates(params.locale, `/jobs/${job.id}`),
    openGraph: { title, description, type: 'website', url: `${BASE}/${params.locale}/jobs/${job.id}` },
  }
}

export default async function JobDetailPage({ params }: { params: Params }) {
  const job = await getJob(params.id)
  if (!job) notFound()
  const isEs = params.locale === 'es'

  const jobLd = jsonLdSafe({
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    ...(job.created_at ? { datePosted: job.created_at } : {}),
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
    hiringOrganization: { '@type': 'Organization', name: job.company_name || 'Employer' },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location || 'El Paso',
        addressRegion: 'TX',
        addressCountry: 'US',
      },
    },
    ...(job.apply_url ? { directApply: false } : {}),
  })

  const breadcrumb = jsonLdSafe(
    breadcrumbJsonLd(params.locale, [
      { name: isEs ? 'Inicio' : 'Home', path: '/' },
      { name: isEs ? 'Empleos' : 'Jobs', path: '/jobs' },
      { name: job.title },
    ])
  )

  const paragraphs = String(job.description || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <CityBeatShell locale={params.locale}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jobLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      <article className="container-wide max-w-3xl py-14">
        <Link
          href={withLocale(params.locale, '/jobs')}
          className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline"
        >
          {isEs ? '← Empleos' : '← Jobs'}
        </Link>

        <h1 className="mt-6 font-display text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
          {job.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold uppercase tracking-wider text-white/60">
          {job.company_name && <span>{job.company_name}</span>}
          {job.location && (
            <>
              <span aria-hidden="true">•</span>
              <span>{job.location}</span>
            </>
          )}
        </div>

        {paragraphs.length > 0 && (
          <div className="mt-8 space-y-4 text-white/80 leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {job.apply_url && (
          <div className="mt-10">
            <a
              href={job.apply_url}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-block rounded bg-brand-gold px-8 py-3 font-black uppercase tracking-widest text-black transition hover:bg-yellow-400"
            >
              {isEs ? 'Postularse' : 'Apply Now'}
            </a>
          </div>
        )}
      </article>
    </CityBeatShell>
  )
}
