'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

interface Lead {
  id: string
  listing_id: string
  business_name: string | null
  created_at: string | null
  unlocked: boolean
  name: string
  contact: string
  message: string | null
}

// Dashboard leads inbox. Premium/Featured listings see full contact details;
// basic listings see masked leads with an upgrade path (the lead ladder).
export function LeadsPanel() {
  const isEs = useLocale() === 'es'
  const [leads, setLeads] = useState<Lead[] | null>(null)

  useEffect(() => {
    fetch('/api/leads/mine')
      .then((r) => (r.ok ? r.json() : { leads: [] }))
      .then((d) => setLeads(d.leads || []))
      .catch(() => setLeads([]))
  }, [])

  if (leads === null || leads.length === 0) return null

  const locked = leads.filter((l) => !l.unlocked).length

  return (
    <div className="mb-12">
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

      <div className="grid gap-3">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className={`rounded-lg p-4 border ${lead.unlocked ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  {lead.name}
                  <span className="ml-2 font-medium text-gray-500">{lead.contact}</span>
                </p>
                {lead.business_name && (
                  <p className="text-xs text-gray-500 mt-0.5">{isEs ? 'para' : 'for'} {lead.business_name}</p>
                )}
                {lead.message && (
                  <p className={`text-sm mt-2 ${lead.unlocked ? 'text-gray-700' : 'text-amber-700 italic'}`}>{lead.message}</p>
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
