'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/components/TranslationProvider'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { getPropertyCompany } from '@/lib/property-companies'

export default function PropertyManagementReview() {
  const locale = useLocale() === 'es' ? 'es' : 'en'
  const [rows, setRows] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/property-management', { cache: 'no-store' }), data = await response.json()
      if (!response.ok) throw new Error(data.code)
      setRows([...data.claims.map((x: any) => ({ ...x, kind: 'claim' })), ...data.properties.map((x: any) => ({ ...x, kind: 'property' }))])
    } catch (e) { setError(e instanceof Error ? e.message : 'Review unavailable') }
  }, [])
  useEffect(() => { void load() }, [load])
  async function review(row: any, form: HTMLFormElement, approved: boolean) {
    setBusy(true); setError('')
    const data = new FormData(form)
    try {
      const response = await fetch('/api/admin/property-management', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: row.kind, id: row.id, approved, note: data.get('note'), authority_checked: data.get('authority') === 'on' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.code)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Review failed') }
    finally { setBusy(false) }
  }
  return <CityBeatShell locale={locale}><div className="citybeat-app container-wide py-10">
    <Link href={`/${locale}/admin/claims`} className="font-bold text-brand-neon">← Claims</Link>
    <h1 className="mt-5 text-3xl font-black">Corporate portfolios & rental property review</h1>
    <p className="mt-4 max-w-4xl leading-7 text-white/65">Verify the representative’s authority using independently confirmed company contacts and the property roster. A verified email or payment alone is insufficient. Corporate approval cannot overwrite an existing owner or individual subscription. New properties also require an address/duplicate check and confirmation of management authority.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-400 p-4">{error}. Ownership or billing conflicts must be resolved before approval; do not overwrite another account.</p>}
    <button onClick={() => void load()} className="mt-5 min-h-11 font-bold text-brand-neon">Refresh review queue</button>
    <div className="mt-5 grid gap-6">{rows.map(row => <article key={`${row.kind}-${row.id}`} className="rounded-xl border border-white/20 bg-brand-ink p-6">
      <p className="text-xs font-black uppercase text-brand-neon">{row.kind === 'claim' ? 'Corporate authority claim' : 'New paid rental listing'}</p>
      <h2 className="mt-3 text-2xl font-bold">{getPropertyCompany(row.company_id || row.property_account_id)?.name || row.proposed_company?.name || row.property_account_id} {row.name && `— ${row.name}`}</h2>
      {row.kind === 'claim' ? <div className="mt-4 space-y-3 text-white/75"><p>{row.email} · {row.role}</p><p className="whitespace-pre-wrap">{row.evidence}</p><p>{row.property_slugs?.length || 0} catalog locations requested</p></div> : <div className="mt-4 space-y-3 text-white/75"><p>{row.property_type} · {row.address}, {row.city}, {row.state} {row.zip}</p><p>{row.phone} · {row.website}</p><p className="whitespace-pre-wrap">{row.description}</p><p className="whitespace-pre-wrap">{row.description_es}</p></div>}
      <form className="mt-6 grid gap-4" onSubmit={event => { event.preventDefault(); void review(row, event.currentTarget, true) }}>
        <label className="grid gap-2 font-bold">Review notes / evidence checked<textarea name="note" required minLength={20} maxLength={3000} rows={3} className="rounded-lg border border-white/25 bg-brand-ink p-3 text-white"/></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="authority" className="h-5 w-5"/>I independently checked management authority, the portfolio/property identity, and any existing ownership or billing.</label>
        <div className="flex gap-3"><button disabled={busy} className="min-h-12 rounded-lg bg-brand-neon px-5 font-black text-black">Approve</button><button type="button" disabled={busy} onClick={event => { const form = event.currentTarget.form!; if (form.reportValidity()) void review(row, form, false) }} className="min-h-12 rounded-lg border border-white/30 px-5 font-bold">Decline with notes</button></div>
      </form>
    </article>)}</div>
    {!rows.length && !error && <p className="mt-8 text-white/65">No pending corporate claims or rental properties.</p>}
  </div></CityBeatShell>
}
