'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'

type Placement = {
  id: string
  name: string
  description: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [placements, setPlacements] = useState<Placement[]>([])
  const [placementId, setPlacementId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creativeFile, setCreativeFile] = useState<File | null>(null)
  const [destinationUrl, setDestinationUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => {
    return placementId && startDate && endDate && creativeFile && destinationUrl
  }, [placementId, startDate, endDate, creativeFile, destinationUrl])

  useEffect(() => {
    const fetchPlacements = async () => {
      const { data, error: fetchError } = await supabase
        .from('ad_placements')
        .select('id, name, description')
        .order('name')

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setPlacements(data ?? [])
    }

    fetchPlacements()
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You are no longer signed in.')
      setLoading(false)
      return
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start >= end) {
      setError('End date must be after start date.')
      setLoading(false)
      return
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('ad_campaigns')
      .insert({
        placement_id: placementId,
        created_by: user.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'pending',
      })
      .select('id')
      .single()

    if (campaignError || !campaign) {
      setError(campaignError?.message ?? 'Unable to create campaign.')
      setLoading(false)
      return
    }

    // Upload creative image
    if (creativeFile) {
      const path = `campaigns/${campaign.id}/creative-${Date.now()}-${creativeFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('ads')
        .upload(path, creativeFile, { upsert: true })

      if (uploadError) {
        setError(uploadError.message)
        setLoading(false)
        return
      }

      // Create ad creative record
      const { error: creativeError } = await supabase
        .from('ad_creatives')
        .insert({
          campaign_id: campaign.id,
          image_path: path,
          destination_url: destinationUrl,
        })

      if (creativeError) {
        setError(creativeError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    router.push(`/advertiser/campaigns/${campaign.id}`)
    router.refresh()
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">New Campaign</h2>
        <p className="mt-2 text-sm text-ink/70">
          Create an ad campaign by selecting a placement, dates, uploading creative, and setting destination URL.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-ink/10 bg-white/80 p-6"
      >
        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Ad Placement
          </label>
          <select
            value={placementId}
            onChange={(event) => setPlacementId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          >
            <option value="">Select placement</option>
            {placements.map((placement) => (
              <option key={placement.id} value={placement.id}>
                {placement.name} {placement.description ? `(${placement.description})` : ''}
              </option>
            ))}
          </select>
          {placements.length === 0 ? (
            <p className="mt-2 text-xs text-ink/50">
              No placements available. Contact administrator.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Creative Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setCreativeFile(event.target.files?.[0] ?? null)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          />
          {creativeFile ? (
            <p className="mt-2 text-xs text-ink/60">
              Selected: {creativeFile.name} ({(creativeFile.size / 1024).toFixed(2)} KB)
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Destination URL
          </label>
          <input
            type="url"
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            placeholder="https://example.com"
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-lg bg-accent px-4 py-3 text-xs uppercase tracking-[0.25em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Creating Campaign...' : 'Pay & Launch'}
        </button>
      </form>
    </section>
  )
}
