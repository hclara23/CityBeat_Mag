'use client'
import { useCallback, useEffect, useState } from 'react'

type Source = { id: string; name: string; enabled: boolean; permission_basis: string; permission_evidence: string; permission_expires: string }
type Update = { id: string; title: string; status: string; source_name: string }
export default function SportsDesk() {
  const [sources, setSources] = useState<Source[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [message, setMessage] = useState('')
  const [credential, setCredential] = useState<{ id: string; token: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/sports', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    setSources(data.sources); setUpdates(data.updates)
  }, [])
  useEffect(() => { load().catch(e => setMessage(e.message)) }, [load])
  async function submit(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    setBusy(true); setMessage('Saving…'); setCredential(null)
    try {
      const response = await fetch('/api/admin/sports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, action, rights_confirmed: values.rights_confirmed === 'on' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (result.token) setCredential(result)
      setMessage(action === 'source' ? 'Source activated. Save the source credential securely; it is displayed once.' : 'Sports update published.')
      form.reset(); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed') }
    finally { setBusy(false) }
  }
  async function patch(id: string, action: string) {
    if (!window.confirm(action === 'disable' ? 'Disable this source and hide its updates from the sports page?' : 'Withdraw this update from the sports page?')) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/sports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
      if (!response.ok) throw new Error('Action failed')
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed') }
    finally { setBusy(false) }
  }
  const input = 'rounded bg-white/10 p-3 text-white'
  return <main className="container-wide py-12 text-white">
    <h1 className="font-display text-4xl font-black">Sports desk</h1>
    <p className="mt-4 text-white/70">Publish your own reporting or text a source has authorized for commercial publication. Public RSS availability and attribution alone are not permission. No external scraper or paid feed is enabled.</p>
    <p className="mt-3 text-white/60">Authorized sources can push updates automatically to /api/ingest/sports using their own credential. Expired or disabled permissions stop ingestion and hide that source’s updates. Imported images and full-article scraping are not supported.</p>
    <p role="status" className="my-6 text-brand-neon">{message}</p>
    {credential && <section className="mb-6 rounded border border-brand-neon p-5"><h2 className="font-bold">Save securely — do not share in screenshots</h2><p>Source ID: <code>{credential.id}</code></p><label className="mt-3 block">Bearer token<input readOnly type="password" value={credential.token} className={input + ' w-full'} /></label><button onClick={() => navigator.clipboard.writeText(credential.token).then(() => setMessage('Token copied.'))} className="mt-3 underline">Copy token</button><button onClick={() => setCredential(null)} className="ml-5 underline">Hide credential</button></section>}
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={event => submit(event, 'source')} className="grid gap-4 rounded-xl border border-white/15 p-6">
        <h2 className="text-2xl font-bold">Authorize a source</h2>
        <label className="grid gap-2">Source name<input name="name" required minLength={2} maxLength={100} className={input} /></label>
        <label className="grid gap-2">Rights basis<select name="permission_basis" className={input}><option value="owned">CityBeat-owned content</option><option value="written_permission">Written commercial publication permission</option><option value="licensed">Existing license (no purchase here)</option></select></label>
        <label className="grid gap-2">Permission evidence / record<textarea name="permission_evidence" required minLength={10} maxLength={2000} className={input} placeholder="Name/date of written agreement, permitted text and attribution requirements; or explanation of CityBeat ownership." /></label>
        <label className="grid gap-2">Permission review / expiry date<input name="permission_expires" type="date" required className={input} /></label>
        <label className="flex gap-3"><input type="checkbox" name="rights_confirmed" required /><span>I verified this source permits automatic commercial publication of the text it sends, including required attribution.</span></label>
        <button disabled={busy} className="rounded bg-brand-neon p-3 font-bold text-black disabled:opacity-50">Activate source</button>
      </form>
      <form onSubmit={event => submit(event, 'publish')} className="grid gap-4 rounded-xl border border-white/15 p-6">
        <h2 className="text-2xl font-bold">Publish an authorized update</h2>
        <label className="grid gap-2">Source<select required name="source_id" className={input}><option value="">Choose authorized source</option>{sources.filter(s => s.enabled && Date.parse(s.permission_expires) > Date.now()).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="grid gap-2">Headline<input name="title" required minLength={5} maxLength={180} className={input} /></label>
        <label className="grid gap-2">Byline<input name="author" required minLength={2} maxLength={100} className={input} /></label>
        <label className="grid gap-2">Update text<textarea name="body" required minLength={20} maxLength={4000} rows={6} className={input} /></label>
        <label className="grid gap-2">Original source link (optional)<input name="source_url" type="url" maxLength={1000} className={input} /></label>
        <label className="flex gap-3"><input type="checkbox" name="rights_confirmed" required /><span>I verified this text is accurate and authorized for publication.</span></label>
        <button disabled={busy} className="rounded bg-brand-neon p-3 font-bold text-black disabled:opacity-50">Publish to sports</button>
      </form>
    </div>
    <h2 className="mt-10 text-2xl font-bold">Source permissions</h2>
    {!sources.length && <p className="mt-4 text-white/60">No sources authorized yet. UTEP, MiLB and USL feeds are not enabled.</p>}
    {sources.map(s => <div key={s.id} className="mt-4 rounded border border-white/15 p-4"><strong>{s.name}</strong> — {s.enabled && Date.parse(s.permission_expires) > Date.now() ? 'Active' : 'Disabled / expired'}<p className="mt-2 text-sm text-white/60">{s.permission_evidence}</p><p className="text-sm">Expires: {s.permission_expires.slice(0, 10)}</p>{s.enabled && <button disabled={busy} onClick={() => patch(s.id, 'disable')} className="mt-3 underline">Disable source</button>}</div>)}
    <h2 className="mt-10 text-2xl font-bold">Recent updates</h2>
    {updates.map(u => <div key={u.id} className="mt-4 rounded border border-white/15 p-4"><strong>{u.title}</strong><p>{u.source_name} · {u.status}</p>{u.status === 'published' && <button disabled={busy} onClick={() => patch(u.id, 'withdraw')} className="mt-2 underline">Withdraw</button>}</div>)}
  </main>
}
