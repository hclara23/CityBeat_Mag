'use client'

import { useEffect, useState } from 'react'

export function GoogleBusinessConnection({ listingId, locale }: { listingId: string; locale: 'en' | 'es' }) {
  const es = locale === 'es'
  const [state, setState] = useState<any>({ loading: true })
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const endpoint = `/api/directory/${encodeURIComponent(listingId)}/google-business`
  const load = async () => setState(await fetch(endpoint).then(r => r.json()).catch(() => ({ error: 'Unavailable' })))
  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (action: string, more: any = {}) => {
    setBusy(true)
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, locale, ...more }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Request failed')
      if (body.url) window.location.assign(body.url)
      else if (body.patch) setPreview(body)
      else { setPreview(null); await load() }
    } catch (error: any) { setState((s: any) => ({ ...s, error: error.message })) }
    finally { setBusy(false) }
  }
  if (state.loading) return <p className="mt-3 text-sm text-white/60">{es ? 'Comprobando conexión…' : 'Checking connection…'}</p>
  if (!state.configured) return <p className="mt-3 text-sm text-amber-300">{es ? 'La integración está preparada, pero el administrador todavía debe activar las credenciales aprobadas por Google.' : 'The integration is ready, but an administrator must still activate Google-approved credentials.'}</p>
  if (!state.connected) return <button type="button" disabled={busy} onClick={() => void act('connect')} className="mt-4 rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase text-black disabled:opacity-50">{es ? 'Conectar con Google' : 'Connect Google Business Profile'}</button>
  const selected = state.selected_location || state.locations?.[0]?.name || ''
  return <div className="mt-4 space-y-3">
    <label className="block text-xs font-bold uppercase text-white/70">{es ? 'Ubicación autorizada' : 'Authorized location'}</label>
    <select className="w-full rounded-md border border-white/15 bg-black/40 p-3 text-white" defaultValue={selected} onChange={e => void act('preview', { location: e.target.value })}>
      <option value="">{es ? 'Selecciona una ubicación' : 'Choose a location'}</option>
      {(state.locations || []).map((l: any) => <option key={l.name} value={l.name}>{l.title || l.name}</option>)}
    </select>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!selected || busy} onClick={() => void act('preview', { location: selected })} className="rounded-md bg-brand-neon px-3 py-2 text-xs font-black uppercase text-black disabled:opacity-50">{es ? 'Revisar datos' : 'Review imported fields'}</button>
      <button type="button" disabled={busy} onClick={() => void act('refresh_locations')} className="rounded-md border border-white/20 px-3 py-2 text-xs font-bold">{es ? 'Actualizar ubicaciones' : 'Refresh locations'}</button>
      <button type="button" disabled={busy} onClick={() => void act('disconnect')} className="rounded-md border border-red-400/40 px-3 py-2 text-xs font-bold text-red-300">{es ? 'Desconectar' : 'Disconnect'}</button>
    </div>
    {preview && <div className="rounded-lg border border-brand-neon/30 bg-brand-neon/5 p-4">
      <p className="text-sm font-bold">{es ? 'Vista previa — Google no será modificado' : 'Import preview — Google will not be changed'}</p>
      <dl className="mt-2 grid gap-2 text-xs text-white/70 sm:grid-cols-2">{Object.entries(preview.patch || {}).map(([key, value]) => <div key={key}><dt className="font-bold uppercase text-white/50">{key}</dt><dd className="break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value || '—')}</dd></div>)}</dl>
      <button type="button" disabled={busy} onClick={() => void act('apply', { location: preview.location.name, confirmed: true })} className="mt-4 rounded-md bg-brand-magenta px-3 py-2 text-xs font-black uppercase text-white">{es ? 'Aplicar a CityBeat' : 'Apply reviewed fields to CityBeat'}</button>
    </div>}
    {state.error && <p className="text-sm text-red-300">{state.error}</p>}
  </div>
}
