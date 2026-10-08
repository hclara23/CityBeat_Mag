'use client'

import { useCallback, useEffect, useState } from 'react'

type Item = { id: string; status: string; image_url: string; notes: string; caption?: string; reason?: string; facebook_url?: string; created_at: number }
type State = { enabled: boolean; reserved_cents: number; monthly_limit_cents: number; items: Item[] }

export default function SocialQueuePage() {
  const [data, setData] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/social-queue', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Could not load queue')
    setData(body)
  }, [])
  useEffect(() => { load().catch(e => setMessage(e.message)) }, [load])
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true); setMessage('Uploading, writing caption and independently reviewing. This can take a few minutes; the queue is saved before processing.')
    try {
      const response = await fetch('/api/admin/social-queue', { method: 'POST', body: new FormData(form) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`Image accepted. Processing result: ${result.status}.`)
      form.reset()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request interrupted. Refresh the queue before uploading again.') }
    finally { setBusy(false); await load().catch(() => {}) }
  }
  async function action(item: Item, action: 'cancel' | 'retry') {
    const notes = action === 'retry' ? window.prompt('Correct or add factual context. Both agents will review again (counts against the monthly allowance).', item.notes) : item.notes
    if (notes === null) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/social-queue', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, action, notes }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`Result: ${result.status}`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed') }
    finally { setBusy(false); await load().catch(() => {}) }
  }
  return <main className="container-wide py-12 text-white">
    <h1 className="font-display text-4xl font-black">Social image queue</h1>
    <p className="mt-3 text-white/70">Upload → caption writer → independent image review → City BEAT Magazine on Facebook. Rejected captions get one revision, then stop for your review.</p>
    <p className="mt-3">Automation: <strong>{data ? (data.enabled ? 'Active' : 'Disabled — uploads will wait') : 'Checking…'}</strong>. Monthly allowance reserved: ${((data?.reserved_cents || 0) / 100).toFixed(2)} / $5.00.</p>
    <p className="mt-2 text-sm text-white/60">Each review attempt reserves $0.10 conservatively (up to 50 per UTC month); this is not an invoice. Actual OpenAI usage should be lower. AI review can miss errors.</p>
    <form onSubmit={upload} className="my-8 grid gap-4 rounded-xl border border-white/15 p-6">
      <label className="grid gap-2">Drop or choose an image<input required type="file" name="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="rounded border border-white/20 p-5" /></label>
      <label className="grid gap-2">Factual context (optional)<textarea name="notes" maxLength={1000} disabled={busy} className="rounded bg-white/10 p-3" placeholder="Verified event name, date or context. Do not include private details." /></label>
      <label className="flex gap-3"><input required type="checkbox" name="rights_confirmed" value="true" disabled={busy} /><span>I own this image or have permission and necessary consent to publish it. I authorize automated Facebook posting after review and understand the uploaded image URL is public.</span></label>
      <button disabled={busy} className="rounded bg-brand-neon px-5 py-3 font-bold text-black disabled:opacity-50">{busy ? 'Processing…' : 'Upload for automatic review & posting'}</button>
    </form>
    <p role="status" className="mb-5 text-brand-neon">{message}</p>
    <button onClick={() => load().catch(e => setMessage(e.message))} className="mb-6 rounded border border-white/20 px-4 py-2">Refresh queue</button>
    {data?.items.length === 0 && <p>No images queued yet.</p>}
    <div className="grid gap-5 md:grid-cols-2">{data?.items.map(item => <article key={item.id} className="rounded-xl border border-white/15 p-5">
      {/* Stored normalized first-party image; no third-party image optimizer fetch. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="Uploaded image awaiting or following editorial review" className="mb-4 max-h-64 w-full rounded object-contain" />
      <p className="font-bold text-brand-neon">{item.status.replace(/_/g, ' ')}</p>
      <p className="mt-2 whitespace-pre-wrap">{item.caption || 'No caption yet'}</p>
      <p className="mt-2 text-sm text-white/60">{item.reason}</p>
      {item.facebook_url && <a className="mt-3 inline-block underline" href={item.facebook_url} target="_blank" rel="noopener noreferrer">View Facebook post</a>}
      <div className="mt-4 flex gap-4">
        {['queued', 'reviewing', 'needs_review'].includes(item.status) && <button disabled={busy} onClick={() => action(item, 'cancel')} className="underline">Cancel</button>}
        {item.status === 'needs_review' && <button disabled={busy} onClick={() => action(item, 'retry')} className="underline">Correct context & review again</button>}
      </div>
    </article>)}</div>
  </main>
}
