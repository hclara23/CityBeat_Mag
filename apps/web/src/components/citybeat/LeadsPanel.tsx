'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'
import { LEAD_STATUSES, normalizeLeadStatus, type LeadStatus } from '@/lib/premium-value'

interface Lead {
  id: string
  listing_id: string
  business_name: string | null
  created_at: string | null
  unlocked: boolean
  name: string
  contact: string
  message: string | null
  status: LeadStatus
}

// Dashboard leads inbox. Premium/Featured listings see full contact details;
// basic listings see masked leads with an upgrade path (the lead ladder).
export function LeadsPanel({ listingId, embedded = false }: { listingId?: string; embedded?: boolean } = {}) {
  const isEs = useLocale() === 'es'
  const [leads, setLeads] = useState<Lead[] | null>(null)

  useEffect(() => {
    fetch('/api/leads/mine')
      .then((r) => (r.ok ? r.json() : { leads: [] }))
      .then((d) => setLeads((d.leads || []).filter((lead: Lead) => !listingId || lead.listing_id === listingId)))
      .catch(() => setLeads([]))
  }, [listingId])

  if (leads === null) return <p className="text-sm text-white/45">{isEs ? 'Cargando clientes…' : 'Loading leads…'}</p>
  if (leads.length === 0) return <p className="text-sm text-white/45">{isEs ? 'Todavía no hay solicitudes de clientes.' : 'No customer requests yet.'}</p>

  const locked = leads.filter((l) => !l.unlocked).length
  const won = leads.filter((lead) => lead.unlocked && normalizeLeadStatus(lead.status) === 'won').length
  const contacted = leads.filter((lead) => lead.unlocked && normalizeLeadStatus(lead.status) === 'contacted').length

  return (
    <div className={embedded ? '' : 'mb-12'}>
      <h2 className="text-2xl font-bold mb-2">{isEs ? 'Clientes potenciales' : 'Customer leads'}</h2>
      <p className="text-sm text-gray-500 mb-6">
        {isEs
          ? 'Personas que pidieron que las contactes a través de tus fichas.'
          : 'People who asked to be contacted through your listings.'}
        {locked > 0 && (
          <span className="font-semibold text-gray-700">
            {' '}
            {isEs
              ? `${locked} ${locked === 1 ? 'contacto está esperando' : 'contactos están esperando'} — sube esa ficha a Premium para desbloquear los datos de contacto.`
              : `${locked} lead${locked === 1 ? ' is' : 's are'} waiting — upgrade that listing to Premium to unlock contact details.`}
          </span>
        )}
      </p>

      {leads.some((lead) => lead.unlocked) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase text-white/40">{isEs ? 'Prospectos' : 'Leads'}</p><p className="text-2xl font-black text-white">{leads.filter((lead) => lead.unlocked).length}</p></div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase text-white/40">{isEs ? 'Contactados' : 'Contacted'}</p><p className="text-2xl font-black text-brand-neon">{contacted}</p></div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase text-white/40">{isEs ? 'Ganados' : 'Won'}</p><p className="text-2xl font-black text-brand-neon">{won}</p></div>
        </div>
      )}

      <div className="grid gap-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className={`rounded-lg p-4 border ${lead.unlocked ? 'bg-white/5 border-white/10' : 'bg-amber-400/10 border-amber-400/30'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  {lead.name}
                  <span className="ml-2 font-medium text-white/60">{lead.contact}</span>
                </p>
                {lead.business_name && (
                  <p className="text-xs text-white/60 mt-0.5">{isEs ? 'para' : 'for'} {lead.business_name}</p>
                )}
                {lead.message && (
                  <p className={`text-sm mt-2 ${lead.unlocked ? 'text-white/70' : 'text-amber-300 italic'}`}>{lead.message}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {!lead.unlocked && (
                  <span className="inline-block rounded bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                    🔒 {isEs ? 'Bloqueado' : 'Locked'}
                  </span>
                )}
                {lead.created_at && (
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(lead.created_at).toLocaleDateString(isEs ? 'es-MX' : 'en-US')}</p>
                )}
                {lead.unlocked && (
                  <select
                    aria-label={isEs ? 'Estado del cliente' : 'Lead status'}
                    value={normalizeLeadStatus(lead.status)}
                    onChange={async (event) => {
                      const status = normalizeLeadStatus(event.target.value)
                      setLeads((current) => current?.map((item) => item.id === lead.id ? { ...item, status } : item) || [])
                      const response = await fetch(`/api/leads/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                      if (!response.ok) setLeads((current) => current?.map((item) => item.id === lead.id ? { ...item, status: lead.status } : item) || [])
                    }}
                    className="mt-2 rounded border border-white/15 bg-black/35 px-2 py-1 text-[10px] font-black uppercase text-white"
                  >
                    {LEAD_STATUSES.map((status) => <option key={status} value={status}>{isEs ? ({ new: 'Nuevo', contacted: 'Contactado', won: 'Ganado', lost: 'Perdido' } as const)[status] : status}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
