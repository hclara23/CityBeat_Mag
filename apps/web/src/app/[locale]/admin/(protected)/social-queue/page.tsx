'use client'

import { useCallback, useEffect, useState } from 'react'
import { nextSlot, QUEUE_TIMEZONE } from '@/lib/social-schedule'
import { PromotionWorkbench } from '@/components/citybeat/PromotionWorkbench'

type Item = { id: string; status: string; image_url: string; notes: string; article_url?: string; caption?: string; reason?: string; facebook_url?: string; created_at: number; scheduled_at?: number; original_name?: string }
type State = { enabled: boolean; paused: boolean; reserved_cents: number; monthly_limit_cents: number; items: Item[] }
const formatTime = (time?: number) => time ? new Intl.DateTimeFormat('en-US', { timeZone: QUEUE_TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }).format(time) : 'Not assigned'
const field = 'w-full rounded border border-white/20 bg-white/10 p-3'

export default function SocialQueuePage() {
  const [data, setData] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [failures, setFailures] = useState<string[]>([])
  const [editing, setEditing] = useState<Item | null>(null)
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/social-queue', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Could not load queue')
    setData(body)
  }, [])
  useEffect(() => {
    load().catch(e => setMessage(e.message))
    const timer = setInterval(() => load().catch(() => {}), 30_000)
    return () => clearInterval(timer)
  }, [load])
  function choose(selected: File[]) {
    if (selected.length > 100) { setMessage('Choose up to 100 graphics per batch.'); return }
    setFiles(selected); setFailures([])
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!files.length) { setMessage('Choose or drop your graphics first.'); return }
    const common = new FormData(event.currentTarget)
    const remaining: File[] = [], errors: string[] = []
    setBusy(true); setFailures([])
    let accepted = 0, duplicates = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setMessage(`Saving ${i + 1} of ${files.length}: ${file.name}. Keep this tab open until uploads finish.`)
      try {
        const body = new FormData()
        body.set('file', file)
        for (const name of ['notes', 'article_url', 'rights_confirmed']) body.set(name, String(common.get(name) || ''))
        const response = await fetch('/api/admin/social-queue', { method: 'POST', body })
        const result = await response.json()
        if (response.status === 409) { duplicates++; continue }
        if (!response.ok) throw new Error(result.error || 'Upload failed')
        accepted++
      } catch (error) { remaining.push(file); errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload interrupted'}`) }
    }
    setFiles(remaining); setFailures(errors); setBusy(false)
    setMessage(`${accepted} saved for automatic review and scheduling. ${duplicates} duplicates skipped. ${remaining.length} need another upload. You can close this page after saving; the robot works in the background.`)
    await load().catch(() => {})
  }
  async function action(action: string, item?: Item, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/social-queue', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item?.id, action, ...extra }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setMessage(`Queue updated: ${result.status}.`); setEditing(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed') }
    finally { setBusy(false); await load().catch(() => {}) }
  }
  const items = [...(data?.items || [])].sort((a, b) => {
    const active = (i: Item) => ['queued', 'reviewing', 'scheduled'].includes(i.status) ? 0 : 1
    return active(a) - active(b) || (a.scheduled_at || a.created_at) - (b.scheduled_at || b.created_at)
  })
  const occupied = Object.fromEntries(items.filter(i => ['uploading', 'queued', 'reviewing', 'scheduled', 'publishing'].includes(i.status)).map(i => [String(i.scheduled_at), i.id]))
  const options: number[] = []
  let cursor = Date.now() + 30 * 60_000
  for (let i = 0; i < 93; i++) { const t = nextSlot(Date.now(), {}, cursor); options.push(t); cursor = t + 1 }
  return <main className="container-wide py-12 text-white">
    <h1 className="font-display text-4xl font-black">Social image queue</h1>
    <PromotionWorkbench />
    <p className="mt-3 text-white/70">Drop a week or month of graphics. The robot writes each caption, independently reviews it, then posts approved images to City BEAT Magazine on Facebook.</p>
    <div className="my-6 rounded-xl border border-brand-neon/40 bg-brand-neon/5 p-5">
      <h2 className="text-xl font-bold text-brand-neon">6 AM · Noon · 6 PM — daily</h2>
      <p className="mt-2">All times are El Paso time (Mountain Time, with daylight saving). Uploads never publish immediately. Empty slots are skipped; you can fill gaps manually.</p>
      <p className="mt-2">Robot: <strong>{data ? (data.paused ? 'Paused' : data.enabled ? 'Active' : 'Disabled — saved uploads will wait') : 'Checking…'}</strong></p>
      <p className="mt-2 text-sm text-white/60">The worker checks every 10 minutes. Slots are targets, not a guarantee of exact-second delivery. Missed windows and rejected captions are held for your review, never dumped onto Facebook.</p>
      <button disabled={busy || !data} onClick={() => action(data?.paused ? 'resume_all' : 'pause_all')} className="mt-4 rounded border border-white/30 px-4 py-2 disabled:opacity-50">{data?.paused ? 'Resume robot' : 'Pause robot'}</button>
      <p className="mt-2 text-xs text-white/50">Pause stops new work. A Facebook submission already in progress cannot be recalled.</p>
    </div>
    <p>AI allowance reserved: ${((data?.reserved_cents || 0) / 100).toFixed(2)} / $5.00 per UTC month.</p>
    <p className="mt-2 text-sm text-white/60">Each preparation reserves $0.04, including up to two writer/reviewer rounds. Up to 125 preparations per month; retries also count. Actual usage is lower than the reservation. Items wait when the allowance is exhausted. AI review can miss errors.</p>
    <form onSubmit={upload} className="my-8 grid gap-4 rounded-xl border border-white/15 p-6">
      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) choose(Array.from(e.dataTransfer.files)) }} className="rounded-xl border-2 border-dashed border-brand-neon/50 p-8 text-center">
        <label className="grid gap-3 font-bold">Drop graphics here or choose files<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => choose(Array.from(e.target.files || []))} className="mx-auto max-w-full text-sm" /></label>
        <p className="mt-3 text-sm text-white/60">Up to 100 images per batch/day · JPEG, PNG or WebP · under 8 MB each</p>
        <p className="mt-3 text-brand-neon">{files.length ? `${files.length} graphics selected` : 'No files selected'}</p>
        {files.length > 0 && <ul className="mt-3 max-h-36 overflow-auto text-left text-xs text-white/70">{files.map((f, i) => <li key={`${f.name}-${i}`}>{i + 1}. {f.name}</li>)}</ul>}
      </div>
      <label className="grid gap-2">Factual context for this batch (optional)<textarea name="notes" maxLength={1000} disabled={busy} className={field} placeholder="Verified names, dates and background. Leave blank for unrelated graphics; add individual context below after upload." /></label>
      <label className="grid gap-2">CityBeat story link for this batch (optional)<input name="article_url" type="url" disabled={busy} className={field} placeholder="https://citybeatmag.co/en/stories/your-story" /></label>
      <p className="text-sm text-white/60">Context and links apply to every selected image. Use a separate batch for a different story, or edit individual items below. The robot will not invent a link.</p>
      <label className="flex gap-3"><input required type="checkbox" name="rights_confirmed" value="true" disabled={busy} /><span>I have publication rights and necessary consent for every selected image. I authorize automated Facebook posting after review at the assigned times, and understand uploaded images have public URLs.</span></label>
      <button disabled={busy || !files.length} className="rounded bg-brand-neon px-5 py-3 font-bold text-black disabled:opacity-50">{busy ? 'Working…' : 'Save batch to automatic queue'}</button>
    </form>
    <p role="status" className="mb-5 text-brand-neon">{message}</p>
    {failures.length > 0 && <ul className="mb-5 text-sm text-red-300">{failures.map((e, i) => <li key={i}>{e}</li>)}</ul>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Posting calendar & review queue</h2><button onClick={() => load().catch(e => setMessage(e.message))} className="rounded border border-white/20 px-4 py-2">Refresh queue</button></div>
    {data?.items.length === 0 && <p>No graphics queued yet. Your first batch will fill upcoming slots automatically.</p>}
    <div className="grid gap-5 md:grid-cols-2">{items.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-white/15 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt={item.original_name || 'Queued graphic'} loading="lazy" className="mb-4 max-h-64 w-full rounded object-contain" />
      <p className="font-bold text-brand-neon">{item.status.replace(/_/g, ' ')}</p>
      <p className="mt-1 font-semibold">{formatTime(item.scheduled_at)} · El Paso</p>
      <p className="mt-1 break-words text-xs text-white/50">{item.original_name}</p>
      <p className="mt-3 whitespace-pre-wrap break-words">{item.caption || 'Caption will appear after the robot reviews this image.'}</p>
      {item.article_url && <a className="mt-2 block break-all text-sm underline" href={item.article_url} target="_blank" rel="noopener noreferrer">{item.article_url}</a>}
      <p className="mt-2 text-sm text-white/60">{item.reason}</p>
      {item.facebook_url && <a className="mt-3 inline-block underline" href={item.facebook_url} target="_blank" rel="noopener noreferrer">View Facebook post</a>}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {['queued', 'reviewing', 'needs_review', 'scheduled', 'paused'].includes(item.status) && <>
          <button disabled={busy} onClick={() => setEditing(item)} className="underline">Edit / move slot</button>
          {item.status === 'paused' ? <button disabled={busy} onClick={() => action('resume', item)} className="underline">Resume & review</button> : <button disabled={busy} onClick={() => action('pause', item)} className="underline">Pause</button>}
          <button disabled={busy} onClick={() => action('cancel', item)} className="underline">Cancel</button>
        </>}
        {item.status === 'needs_review' && <button disabled={busy} onClick={() => action('retry', item)} className="underline">Retry review</button>}
      </div>
      {editing?.id === item.id && <form className="mt-5 grid gap-3 border-t border-white/20 pt-4" onSubmit={e => {
        e.preventDefault(); const form = new FormData(e.currentTarget)
        action('edit', item, { notes: form.get('notes'), caption: form.get('caption'), article_url: form.get('article_url'), ...(form.get('slot') ? { scheduled_at: Number(form.get('slot')) } : {}) })
      }}>
        <label>Factual context<textarea name="notes" maxLength={1000} defaultValue={item.notes} className={field} /></label>
        <label>Caption (leave blank for AI writer)<textarea name="caption" maxLength={1200} defaultValue={item.caption || ''} className={field} /></label>
        <label>Article link<input name="article_url" type="url" defaultValue={item.article_url || ''} className={field} /></label>
        <label>Move to an available slot<select name="slot" className={field} defaultValue=""><option className="bg-black" value="">Next available slot</option>{options.filter(t => !occupied[String(t)] || occupied[String(t)] === item.id).map(t => <option className="bg-black" value={t} key={t}>{formatTime(t)} El Paso</option>)}</select></label>
        <p className="text-xs text-white/60">Saving re-runs independent review and reserves $0.04. No immediate post.</p>
        <button disabled={busy} className="rounded bg-brand-neon p-3 font-bold text-black">Save & review for scheduled slot</button>
        <button type="button" onClick={() => setEditing(null)} className="underline">Close editor</button>
      </form>}
    </article>)}</div>
  </main>
}
