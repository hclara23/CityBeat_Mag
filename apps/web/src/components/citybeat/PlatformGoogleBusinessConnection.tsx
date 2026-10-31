'use client'

import { useCallback, useEffect, useState } from 'react'

export function PlatformGoogleBusinessConnection({ onChange }: { onChange: () => void }) {
  const [state, setState] = useState<any>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/google-business', { cache: 'no-store' })
    if (!response.ok) throw new Error('Google connection settings could not be loaded.')
    const body = await response.json()
    setState(body)
    setSelected(body.selected_location || '')
  }, [])
  useEffect(() => { load().catch(e => setError(e.message)) }, [load])
  async function act(action: string) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/google-business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, location: selected }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Google connection could not be updated.')
      if (body.url) { window.location.assign(body.url); return }
      await load()
      onChange()
    } catch (e: any) { setError(e.message || 'Google connection could not be updated.') }
    finally { setBusy(false) }
  }
  const button = 'rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-white disabled:opacity-40'
  return <div className="mt-4 rounded-xl border border-white/10 p-5">
    <h3 className="font-bold text-white">CityBeat’s Google Business Profile</h3>
    <p className="mt-2 text-sm text-white/55">Choose City Beat Magazine for this dashboard. Advertiser connections remain separate. This connection reads performance and does not edit the public business profile.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    {!state ? <p className="mt-3 text-sm text-white/50">{error ? 'Connection settings unavailable.' : 'Loading connection settings…'}</p> : !state.configured ? <p className="mt-3 text-sm text-amber-200">Direct reporting needs Google Business Profile API approval and OAuth configuration. A Google Analytics product link alone does not enable this API connection.</p> : <div className="mt-3 flex flex-wrap items-center gap-3">
      <button className={button} disabled={busy} onClick={() => act('connect')}>{state.connected ? 'Reconnect Google' : 'Connect Google'}</button>
      {state.connected && <>
        <label className="text-sm text-white">Business profile<select aria-label="CityBeat reporting profile" value={selected} onChange={e => setSelected(e.target.value)} className="ml-2 rounded border border-white/20 bg-black p-2 text-white" disabled={busy}>
          <option value="">Choose a profile</option>
          {state.locations.map((l: any) => <option key={l.name} value={l.name}>{l.title}</option>)}
        </select></label>
        <button className={button} disabled={busy || !selected} onClick={() => act('select')}>Use this profile</button>
        <button className={button} disabled={busy} onClick={() => act('refresh_locations')}>Refresh profiles</button>
        <button className={button} disabled={busy} onClick={() => act('disconnect')}>Disconnect</button>
      </>}
    </div>}
  </div>
}
