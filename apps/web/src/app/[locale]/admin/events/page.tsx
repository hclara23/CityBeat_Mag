'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import Image from 'next/image'

interface Event {
  id: string
  title_en: string
  title_es: string
  meta_en: string
  meta_es: string
  image_url: string
  ticket_url: string
  start_date: string
  created_at: string
}

export default function AdminEventsPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/events')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error('Failed to load events', err)
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
      
      // Check for editor/admin role
      fetch(`/api/profile?id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.profile?.is_editor && !data.profile?.can_manage_platform) {
            router.push(withLocale(locale, '/creator'))
          } else {
            setIsAdmin(true)
            loadEvents()
          }
        })
    })
  }, [router, locale, loadEvents])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const res = await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setEvents(events.filter(e => e.id !== id))
    } catch (err) {
      console.error('Failed to delete event', err)
      alert('Error deleting event')
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-4">
              <Link href={withLocale(locale, '/admin')} className="text-sm text-brand-neon hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="font-display text-4xl font-black uppercase tracking-tight">Events Manager</h1>
            <p className="mt-1 text-white/50 text-sm">Review, moderate, and manage scraped events.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-white/50 py-10">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="citybeat-panel p-8 text-center text-white/50">
            No events found.
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map((event) => (
              <div key={event.id} className="citybeat-panel flex flex-col md:flex-row gap-6 p-6">
                {event.image_url && (
                  <div className="shrink-0">
                    <Image 
                      src={event.image_url} 
                      alt="" 
                      width={200} 
                      height={150} 
                      className="rounded-md object-cover w-full md:w-[200px] aspect-[4/3]"
                    />
                  </div>
                )}
                <div className="flex-grow">
                  <h3 className="text-xl font-bold mb-1">{locale === 'en' ? event.title_en : event.title_es}</h3>
                  <p className="text-sm text-brand-gold uppercase tracking-wider mb-2 font-bold">
                    {new Date(event.start_date).toLocaleString(locale === 'en' ? 'en-US' : 'es-MX')}
                  </p>
                  <p className="text-sm text-white/60 mb-4 line-clamp-2">
                    {locale === 'en' ? event.meta_en : event.meta_es}
                  </p>
                  <div className="text-xs text-white/40 mb-4 font-mono">ID: {event.id}</div>
                  
                  <div className="flex gap-3">
                    {event.ticket_url && (
                      <a 
                        href={event.ticket_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition"
                      >
                        View Link
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition border border-red-500/30"
                    >
                      Delete Event
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
