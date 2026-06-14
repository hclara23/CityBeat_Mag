'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card } from '@citybeat/ui'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'
import { AdsNavigation as Navigation } from '@/components/AdsNavigation'
import { createClient } from '@/utils/supabase/client'

export default function JobsAdvertiserPage() {
  const router = useRouter()
  const locale = useLocale()
  const supabase = createClient()
  
  const [config, setConfig] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    location: '',
    description: '',
    apply_url: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('site_settings').select('value').eq('id', 'job_board_config').single()
      if (data) {
        setConfig(data.value)
      } else {
        // Fallback
        setConfig({ price_usd: 50, duration_days: 30 })
      }
    }
    fetchConfig()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.company_name || !formData.location || !formData.description) {
      setError('Please fill out all required fields')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('You must be logged in to post a job.')
      }

      // 2. Insert into jobs table.
      // For this demonstration, we mark it as paid immediately to skip the Stripe integration step,
      // as our focus is on the job board directory functionality. In production, is_paid = false 
      // and a Stripe session is created just like newsletter ads.
      
      const durationDays = config?.duration_days || 30
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + durationDays)

      const { error: dbError } = await supabase.from('jobs').insert({
        owner_id: user.id,
        title: formData.title,
        company_name: formData.company_name,
        location: formData.location,
        description: formData.description,
        apply_url: formData.apply_url,
        is_paid: true,
        expires_at: expiresAt.toISOString()
      })

      if (dbError) throw dbError

      // Redirect to a success page
      router.push(`/${locale}/success?type=job`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <Link href={`/${locale}/campaigns`} className="text-red-600 hover:text-red-700 mb-4 block">
            ← Back to Campaigns
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Post a Job
          </h1>
          <p className="text-xl text-gray-600">
            Reach thousands of local professionals
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-8">
              <form onSubmit={handlePostJob} className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. Senior Barista"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. Coffee Hub"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Location *
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="e.g. El Paso, TX"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="Describe the role, responsibilities, and requirements..."
                    required
                  />
                </div>

                <div>
                  <label htmlFor="apply_url" className="block text-sm font-medium text-gray-700 mb-2">
                    Application URL or Email (Optional)
                  </label>
                  <input
                    type="text"
                    id="apply_url"
                    name="apply_url"
                    value={formData.apply_url}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="https://... or mailto:..."
                  />
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={isLoading || !config}
                    className="w-full bg-red-600 hover:bg-red-700 text-white text-lg py-4"
                  >
                    {isLoading ? 'Processing...' : `Post Job for $${config?.price_usd || 50}`}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-8 bg-gray-50 border-2 border-red-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Pricing & Terms
              </h3>
              
              {config ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="text-gray-600">Price</span>
                    <span className="font-bold text-lg">${config.price_usd}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="text-gray-600">Duration</span>
                    <span className="font-bold text-lg">{config.duration_days} days</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-gray-600 text-sm block mb-2">Terms:</span>
                    <p className="text-xs text-gray-500 bg-white p-3 border rounded">
                      {config.terms || 'Jobs will be active for the specified duration. No refunds.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse flex flex-col space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-full"></div>
                  <div className="h-6 bg-gray-200 rounded w-full"></div>
                  <div className="h-20 bg-gray-200 rounded w-full"></div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
