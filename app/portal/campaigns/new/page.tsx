'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/src/lib/supabase/client'
import { ADS_BUCKET } from '@/src/lib/supabase/constants'

type Placement = {
  id: string
  key: string
  name: string
  size: string
}

type Sponsor = {
  id: string
  name: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [placements, setPlacements] = useState<Placement[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [placementKey, setPlacementKey] = useState('')
  const [sponsorId, setSponsorId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [creativeFile, setCreativeFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchOptions = async () => {
      const { data: placementData } = await supabase
        .from('ad_placements')
        .select('id, key, name, size')
        .order('name')

      const { data: sponsorData } = await supabase
        .from('sponsors')
        .select('id, name')
        .order('name')

      setPlacements(placementData ?? [])
      setSponsors(sponsorData ?? [])
    }

    fetchOptions()
  }, [supabase])

  const canSubmit =
    placementKey &&
    sponsorId &&
    startAt &&
    endAt &&
    destinationUrl &&
    creativeFile

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setError('You are not signed in.')
      setLoading(false)
      return
    }

    const creativePath = `campaigns/${session.user.id}/${Date.now()}-${creativeFile!.name}`
    const { error: uploadError } = await supabase.storage
      .from(ADS_BUCKET)
      .upload(creativePath, creativeFile!, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setLoading(false)
      return
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sponsor_id: sponsorId,
          placement_key: placementKey,
          start_at: new Date(startAt).toISOString(),
          end_at: new Date(endAt).toISOString(),
          destination_url: destinationUrl,
          creative_path: creativePath,
        }),
      }
    )

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(payload.error ?? 'Unable to create checkout session.')
      setLoading(false)
      return
    }

    if (payload.url) {
      window.location.href = payload.url
      return
    }

    setError('No checkout URL returned.')
    setLoading(false)
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-2xl">New Campaign</h2>
        <p className="mt-2 text-sm text-ink/70">
          Upload creative, set dates, and pay in Stripe test mode to activate.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-ink/10 bg-white/80 p-6"
      >
        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Sponsor
          </label>
          <select
            value={sponsorId}
            onChange={(event) => setSponsorId(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          >
            <option value="">Select sponsor</option>
            {sponsors.map((sponsor) => (
              <option key={sponsor.id} value={sponsor.id}>
                {sponsor.name}
              </option>
            ))}
          </select>
          {sponsors.length === 0 ? (
            <p className="mt-2 text-xs text-ink/50">
              No sponsors found. Create one in the Supabase table first.
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Placement
          </label>
          <select
            value={placementKey}
            onChange={(event) => setPlacementKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            required
          >
            <option value="">Select placement</option>
            {placements.map((placement) => (
              <option key={placement.id} value={placement.key}>
                {placement.name} ({placement.size})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
              Start Date
            </label>
            <input
              type="date"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
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
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.25em] text-ink/60">
            Destination URL
          </label>
          <input
            type="url"
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            className="mt-2 w-full rounded-lg border border-ink/20 bg-white px-3 py-2"
            placeholder="https://"
            required
          />
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
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-lg bg-ink px-4 py-3 text-xs uppercase tracking-[0.25em] text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Redirecting...' : 'Pay & Launch'}
        </button>
      </form>
    </section>
  )
}
