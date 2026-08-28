'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

interface Job {
  id: string
  title: string
  company_name: string
  category: string
  employment_type: string
  workplace_type: string
  location: string
  pay_min: number | null
  pay_max: number | null
  pay_period: string
  description: string
  application_email: string
  apply_url: string | null
  status: string
  is_paid: boolean
  is_active: boolean
  expires_at: string | null
  created_at: string
  sold_by_rep: string | null
  contact_email: string | null
  sales_order_id: string | null
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-400/15 text-amber-300',
  published: 'bg-emerald-400/15 text-emerald-300',
  rejected: 'bg-red-400/15 text-red-300',
}

function payLine(job: Job) {
  if (!job.pay_min && !job.pay_max) return null
  const period = job.pay_period ? `/${job.pay_period}` : ''
  if (job.pay_min && job.pay_max) return `$${job.pay_min}–$${job.pay_max}${period}`
  return `$${job.pay_min || job.pay_max}${period}`
}

export default function AdminJobsPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'published' | 'rejected'>('pending_review')

  const loadJobs = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/jobs')
      if (res.status === 401 || res.status === 403) {
        setIsAuthorized(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
        setIsAuthorized(true)
      }
    } catch (err) {
      console.error('Failed to load jobs', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }
      loadJobs()
    })
  }, [router, locale, loadJobs])

  const handleModerate = async (id: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await loadJobs()
    } catch (err) {
      console.error('Moderation failed', err)
      alert(err instanceof Error ? err.message : 'Error updating job')
    }
  }

  if (!isLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-white/70">Sales Desk access required to manage job postings.</p>
        </main>
      </div>
    )
  }

  const visible = filter === 'all' ? jobs : jobs.filter((j) => (j.status || 'pending_review') === filter)
  const pendingCount = jobs.filter((j) => (j.status || 'pending_review') === 'pending_review').length

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-4">
              <Link href={withLocale(locale, '/admin/sales/me')} className="text-sm text-brand-neon hover:underline">
                ← Back to Sales Desk
              </Link>
            </div>
            <h1 className="font-display text-4xl font-black uppercase tracking-tight">Job Postings</h1>
            <p className="mt-1 text-white/50 text-sm">
              Every paid job posting — including Sales Desk sales — lands here for review before it goes live.
              {pendingCount > 0 && <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">{pendingCount} awaiting review</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['pending_review', 'published', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${filter === f ? 'bg-brand-neon text-brand-ink' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-white/50 py-10">Loading job postings...</div>
        ) : visible.length === 0 ? (
          <div className="citybeat-panel p-8 text-center text-white/50">No job postings in this view.</div>
        ) : (
          <div className="grid gap-6">
            {visible.map((job) => {
              const status = job.status || 'pending_review'
              const pay = payLine(job)
              return (
                <div key={job.id} className="citybeat-panel flex flex-col gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold">{job.title || '(untitled)'}</h3>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[status] || STATUS_STYLES.pending_review}`}>
                          {status.replace('_', ' ')}
                        </span>
                        {job.sales_order_id && (
                          <span className="rounded bg-brand-magenta/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-magenta">Sales Desk</span>
                        )}
                      </div>
                      <p className="text-sm text-brand-gold uppercase tracking-wider font-bold">
                        {job.company_name} {job.category ? `· ${job.category}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {[job.location, job.employment_type, job.workplace_type, pay].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      {job.expires_at ? (
                        <p>Live until {new Date(job.expires_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX')}</p>
                      ) : (
                        <p className="text-amber-300">No expiration set yet</p>
                      )}
                      {job.contact_email && <p className="mt-1">Contact: {job.contact_email}</p>}
                    </div>
                  </div>

                  {job.description && <p className="text-sm text-white/60 line-clamp-3">{job.description}</p>}

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                    {job.apply_url && (
                      <a href={job.apply_url} target="_blank" rel="noreferrer" className="rounded bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20">
                        View apply link
                      </a>
                    )}
                    {status !== 'published' && (
                      <button
                        onClick={() => handleModerate(job.id, 'approve')}
                        className="rounded border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-white"
                      >
                        Approve — publish for 30 days
                      </button>
                    )}
                    {status !== 'rejected' && (
                      <button
                        onClick={() => handleModerate(job.id, 'reject')}
                        className="rounded border border-red-500/30 bg-red-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500 hover:text-white"
                      >
                        Reject
                      </button>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-white/30">ID: {job.id}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
