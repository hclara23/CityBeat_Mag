'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/supabase/auth'

interface PendingArticle {
  id: string
  title: string
  author_email: string
  created_at: string
  category_id: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [pending, setPending] = useState<PendingArticle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/articles?status=pending_review')
      if (res.ok) {
        const data = await res.json()
        setPending(data.articles || [])
      }
    } catch (err) {
      console.error('Failed to load admin data', err)
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
      // Check for editor role
      fetch(`/api/profile?id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.profile?.is_editor) {
            router.push(withLocale(locale, '/creator'))
          } else {
            setIsAdmin(true)
            loadData()
          }
        })
    })
  }, [router, locale, loadData])

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-black tracking-tight tracking-tight uppercase">Admin Control</h1>
          <p className="mt-1 text-white/50 text-sm">Review submissions and monitor performance</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Column: Review Queue */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Review Queue
            </h2>
            
            {isLoading ? (
              <div className="p-20 text-center text-white/20">Loading queue...</div>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-20 text-center">
                <p className="text-white/30">The queue is empty. All caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pending.map(article => (
                  <div key={article.id} className="group rounded-xl border border-white/10 bg-brand-charcoal p-5 transition hover:border-white/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 bg-amber-400/10 px-2 py-1 rounded">Pending Review</span>
                      <span className="text-xs text-white/30">{new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold group-hover:text-brand-neon transition">{article.title}</h3>
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                          {article.author_email?.[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-white/50">{article.author_email}</span>
                      </div>
                      <Link 
                        href={withLocale(locale, `/admin/review/${article.id}`)}
                        className="rounded bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: Analytics Snapshot */}
          <div>
            <h2 className="mb-4 text-xl font-bold">Performance</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-white/30 font-bold mb-1">Total Views (24h)</p>
                <p className="text-3xl font-black">12,402</p>
                <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-neon w-[70%]" />
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-white/30 pt-4 border-t border-white/10">Top Stories</p>
                {[
                  { t: "Border Crisis deepens...", v: "4.2k" },
                  { t: "New Art Exhibit in El Paso", v: "2.1k" },
                  { t: "Music Festival Lineup", v: "1.8k" }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <p className="truncate text-xs text-white/70">{s.t}</p>
                    <span className="text-[10px] font-bold text-brand-neon">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
