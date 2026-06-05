'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/supabase/auth'

interface PendingClaim {
  id: string
  name: string
  category: string
  address: string | null
  website: string | null
  phone: string | null
  claimed_at: string | null
  owner_id: string | null
}

interface PostcardClaim {
  id: string
  listing_id: string
  user_id: string
  verification_method: string
  verification_code: string
  status: 'pending' | 'code_sent' | 'verified' | 'rejected'
  created_at: string
  listing?: {
    name: string
    address: string | null
    category: string
  }
  profile?: {
    email: string
  }
}

export default function AdminClaimsDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [claims, setClaims] = useState<PendingClaim[]>([])
  const [postcardClaims, setPostcardClaims] = useState<PostcardClaim[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'premium' | 'postcard'>('premium')

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/claims')
      if (res.ok) {
        const data = await res.json()
        setClaims(data.claims || [])
        setPostcardClaims(data.postcardClaims || [])
      }
    } catch (err) {
      console.error('Failed to load claims queue', err)
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
          if (!data.profile?.is_editor && !data.profile?.can_manage_platform) {
            router.push(withLocale(locale, '/creator'))
          } else {
            setIsAdmin(true)
            loadData()
          }
        })
    })
  }, [router, locale, loadData])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this claim?`)) return
    setProcessingId(id)
    try {
      const response = await fetch(`/api/admin/claims/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        // Remove from list
        setClaims(prev => prev.filter(c => c.id !== id))
      } else {
        alert('Failed to process claim action')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred')
    } finally {
      setProcessingId(null)
    }
  }

  const handleMailPostcard = async (claimId: string) => {
    setProcessingId(claimId)
    try {
      const response = await fetch(`/api/admin/claims/postcard/${claimId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mail' }),
      })

      if (response.ok) {
        // Update local state status to 'code_sent'
        setPostcardClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'code_sent' } : c))
        alert('Postcard marked as mailed! Verification code is now active for simulation.')
      } else {
        alert('Failed to mark postcard as mailed')
      }
    } catch (err) {
      console.error(err)
      alert('An error occurred')
    } finally {
      setProcessingId(null)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-brand-dark text-white citybeat-app">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link href="/admin" className="text-sm font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300 transition">
            ← Back to Admin Control
          </Link>
        </div>

        <div className="mb-10">
          <h1 className="font-display text-4xl font-black tracking-tight uppercase">Claims Review Queue</h1>
          <p className="mt-1 text-white/50 text-sm">Verify business listings owner claims and activate premium tiers</p>
        </div>

        {/* Tabs switcher */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('premium')}
            className={`px-5 py-2.5 rounded-md font-bold uppercase tracking-wider text-xs transition-all ${
              activeTab === 'premium'
                ? 'bg-brand-neon text-black font-black shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                : 'border border-white/10 text-white/70 hover:bg-white/5'
            }`}
          >
            Stripe Premium Claims
          </button>
          <button
            onClick={() => setActiveTab('postcard')}
            className={`px-5 py-2.5 rounded-md font-bold uppercase tracking-wider text-xs transition-all ${
              activeTab === 'postcard'
                ? 'bg-brand-gold text-black font-black shadow-[0_0_12px_rgba(255,215,0,0.3)]'
                : 'border border-white/10 text-white/70 hover:bg-white/5'
            }`}
          >
            Postcard Claims
          </button>
        </div>

        <div className="grid gap-8">
          <div className="citybeat-panel rounded-2xl p-6 border border-white/10">
            {activeTab === 'premium' ? (
              <>
                <h2 className="mb-6 text-xl font-bold flex items-center gap-2 uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-neon animate-pulse" />
                  Pending Owner Claims
                </h2>

                {isLoading ? (
                  <div className="p-20 text-center text-white/40">Loading claims queue...</div>
                ) : claims.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/25 p-20 text-center">
                    <p className="text-white/40">There are no pending premium claims to review. All caught up!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-bold uppercase text-brand-neon tracking-wider">
                          <th className="py-4 px-4">Business</th>
                          <th className="py-4 px-4">Category</th>
                          <th className="py-4 px-4">Claimed At</th>
                          <th className="py-4 px-4">Contact info</th>
                          <th className="py-4 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claims.map((claim) => (
                          <tr key={claim.id} className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 font-bold">
                              <Link href={`/directory/${claim.id}`} target="_blank" className="text-white hover:text-brand-neon transition underline">
                                {claim.name}
                              </Link>
                              {claim.address && (
                                <span className="block text-xs font-medium text-white/40 mt-1 max-w-xs truncate">{claim.address}</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-[10px] font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 px-2.5 py-0.5 rounded">
                                {claim.category}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-white/60">
                              {claim.claimed_at ? new Date(claim.claimed_at).toLocaleString() : 'N/A'}
                            </td>
                            <td className="py-4 px-4 text-xs space-y-1">
                              {claim.phone && <p><span className="text-white/40">Phone:</span> {claim.phone}</p>}
                              {claim.website && (
                                <p>
                                  <span className="text-white/40 font-medium">Web:</span>{' '}
                                  <a href={claim.website} target="_blank" rel="noopener noreferrer" className="text-brand-neon hover:underline truncate inline-block max-w-[150px]">
                                    {claim.website}
                                  </a>
                                </p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex gap-2.5 justify-end">
                                <button
                                  onClick={() => handleAction(claim.id, 'approve')}
                                  disabled={processingId === claim.id}
                                  className="px-3.5 py-1.5 rounded bg-brand-neon text-black font-black uppercase tracking-wider text-[10px] hover:bg-cyan-300 transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(claim.id, 'reject')}
                                  disabled={processingId === claim.id}
                                  className="px-3.5 py-1.5 rounded border border-brand-magenta/30 text-brand-magenta font-black uppercase tracking-wider text-[10px] hover:bg-brand-magenta/10 transition"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="mb-6 text-xl font-bold flex items-center gap-2 uppercase tracking-wide">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-gold animate-pulse" />
                  Postcard Verification Claims
                </h2>

                {isLoading ? (
                  <div className="p-20 text-center text-white/40">Loading claims queue...</div>
                ) : postcardClaims.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/25 p-20 text-center">
                    <p className="text-white/40">There are no pending postcard claims. All caught up!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-xs font-bold uppercase text-brand-gold tracking-wider">
                          <th className="py-4 px-4">Business & Address</th>
                          <th className="py-4 px-4">Owner Email</th>
                          <th className="py-4 px-4">Requested At</th>
                          <th className="py-4 px-4">Verification Code</th>
                          <th className="py-4 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {postcardClaims.map((claim) => {
                          const name = claim.listing?.name || 'Unknown Business'
                          const address = claim.listing?.address || 'Listed Business Address'
                          const email = claim.profile?.email || 'N/A'
                          return (
                            <tr key={claim.id} className="border-b border-white/5 text-sm hover:bg-white/5 transition-colors">
                              <td className="py-4 px-4 font-bold">
                                <Link href={`/directory/${claim.listing_id}`} target="_blank" className="text-white hover:text-brand-gold transition underline">
                                  {name}
                                </Link>
                                <span className="block text-xs font-medium text-white/40 mt-1 max-w-sm truncate">
                                  📮 {address}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-xs text-white/70">
                                {email}
                              </td>
                              <td className="py-4 px-4 text-xs text-white/60">
                                {new Date(claim.created_at).toLocaleString()}
                              </td>
                              <td className="py-4 px-4">
                                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono font-bold text-sm text-brand-gold">
                                  {claim.verification_code}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right">
                                {claim.status === 'pending' ? (
                                  <button
                                    onClick={() => handleMailPostcard(claim.id)}
                                    disabled={processingId === claim.id}
                                    className="px-4 py-1.5 rounded bg-brand-gold text-black font-black uppercase tracking-wider text-[10px] hover:bg-yellow-400 transition"
                                  >
                                    Mark Postcard Mailed
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-black uppercase tracking-wider">
                                    ✓ Mailed
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
