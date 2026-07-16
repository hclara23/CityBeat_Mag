'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'
import { Navigation, Button } from '@citybeat/ui'
import { LocaleToggle } from '@/components/citybeat/LocaleToggle'
import { hasAdvertiserAccess } from '@citybeat/lib/roles'
import { AuthError } from '@citybeat/ui/auth'
import { MyListingsBoost } from '@/components/citybeat/MyListingsBoost'
import { MyDeals } from '@/components/citybeat/MyDeals'
import { LeadsPanel } from '@/components/citybeat/LeadsPanel'
import { AIAssistantPanel } from '@/components/citybeat/AIAssistantPanel'
import { FeaturedBadge } from '@/components/citybeat/FeaturedBadge'

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
  impressions: number
  clicks: number
}

export default function DashboardPage() {
  const router = useRouter()
  const locale = useLocale()
  const isEs = locale === 'es'
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState({
    totalImpressions: 0,
    totalClicks: 0,
    activeCampaigns: 0,
    ctr: 0,
  })
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/dashboard')

        if (response.status === 401) {
          router.push(`/${locale}/login`)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to load dashboard')
        }

        const data = (await response.json()) as {
          profile: any
          campaigns: Campaign[]
          stats: {
            totalImpressions: number
            totalClicks: number
            activeCampaigns: number
            ctr: number
          }
        }

        setProfile(data.profile)
        setCampaigns(data.campaigns)
        setStats(data.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [locale, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation rightSlot={<LocaleToggle />} />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">{isEs ? 'Cargando…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  // Developers/admins are a superset — they can act as an advertiser too.
  const canAdvertise = hasAdvertiserAccess(profile)

  return (
    <div className="min-h-screen bg-white">
      <Navigation rightSlot={<LocaleToggle />} />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold">
              {isEs ? 'Bienvenido' : 'Welcome'}, {profile?.full_name || (isEs ? 'Usuario' : 'User')}
            </h1>
            <a href={`/${locale}/guide`} className="mt-1 inline-block text-xs font-bold text-cyan-600 underline">
              📖 {isEs ? 'Guía del usuario' : 'User Guide'}
            </a>
            <p className="text-gray-600 mt-2">
              {canAdvertise ? (isEs ? 'Panel de anunciante' : 'Advertiser Dashboard') : (isEs ? 'Panel' : 'Dashboard')}
            </p>
          </div>
          {canAdvertise && (
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => router.push(`/${locale}/ads`)}
            >
              {isEs ? 'Crear campaña' : 'Create Campaign'}
            </Button>
          )}
        </div>

        {error && <AuthError message={error} />}

        <AIAssistantPanel />
        <LeadsPanel />
        <MyListingsBoost />
        <FeaturedBadge />
        <MyDeals />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Stats Cards */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">{isEs ? 'Impresiones totales' : 'Total Impressions'}</p>
            <p className="text-3xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">{isEs ? 'Este mes' : 'This month'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">{isEs ? 'Clics totales' : 'Total Clicks'}</p>
            <p className="text-3xl font-bold">{stats.totalClicks.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">{isEs ? 'Este mes' : 'This month'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">{isEs ? 'Tasa de clics' : 'Click-Through Rate'}</p>
            <p className="text-3xl font-bold">{stats.ctr.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-2">{isEs ? 'Este mes' : 'This month'}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">{isEs ? 'Campañas activas' : 'Active Campaigns'}</p>
            <p className="text-3xl font-bold">{stats.activeCampaigns}</p>
            <p className="text-xs text-gray-500 mt-2">{isEs ? 'En ejecución' : 'Currently running'}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-12">
          <h2 className="text-2xl font-bold mb-4">{isEs ? 'Actividad reciente' : 'Recent Activity'}</h2>
          <div className="text-center py-12">
            <p className="text-gray-500">{isEs ? 'Aún no hay datos de actividad' : 'No activity data available yet'}</p>
            <p className="text-sm text-gray-400 mt-2">
              {isEs
                ? 'Las analíticas aparecerán aquí cuando tus campañas estén activas'
                : 'Analytics will appear here once your campaigns go live'}
            </p>
          </div>
        </div>

        {/* Campaigns Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{isEs ? 'Tus campañas' : 'Your Campaigns'}</h2>
            {canAdvertise && campaigns.length > 0 && (
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => router.push(`/${locale}/ads`)}
              >
                {isEs ? 'Nueva campaña' : 'New Campaign'}
              </Button>
            )}
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 border border-gray-200 text-center">
              <p className="text-gray-500">{isEs ? 'Aún no hay campañas' : 'No campaigns yet'}</p>
              <p className="text-sm text-gray-400 mt-2">
                {canAdvertise
                  ? (isEs ? 'Crea tu primera campaña publicitaria para empezar' : 'Create your first advertising campaign to get started')
                  : (isEs ? 'No eres anunciante' : 'You are not an advertiser')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-gray-50 rounded-lg p-6 border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {campaign.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {isEs ? 'Creada el' : 'Created'} {new Date(campaign.created_at).toLocaleDateString(isEs ? 'es-MX' : 'en-US')}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {campaign.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600">{isEs ? 'Impresiones' : 'Impressions'}</p>
                      <p className="text-lg font-semibold">
                        {campaign.impressions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">{isEs ? 'Clics' : 'Clicks'}</p>
                      <p className="text-lg font-semibold">
                        {campaign.clicks.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">CTR</p>
                      <p className="text-lg font-semibold">
                        {campaign.impressions > 0
                          ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
