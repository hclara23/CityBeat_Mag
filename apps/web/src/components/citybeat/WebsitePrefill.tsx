'use client'
import { useState } from 'react'
import type { PrefillFields } from '@/lib/website-prefill'

export function WebsitePrefill({ listingId, current, isEs, allowDescription, onApply }: {
  listingId: string; current: PrefillFields; isEs: boolean; allowDescription: boolean; onApply: (fields: PrefillFields) => void
}) {
  const [url,setUrl]=useState(current.website || '')
  const [confirmed,setConfirmed]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [preview,setPreview]=useState<{fields:PrefillFields;source_url:string}|null>(null)
  const [selected,setSelected]=useState<string[]>([])
  const labels = isEs ? {name:'Nombre',phone:'Teléfono',address:'Dirección',description:'Descripción',website:'Sitio web'} : {name:'Name',phone:'Phone',address:'Address',description:'Description',website:'Website'}
  const inspect=async()=>{
    setBusy(true);setError('');setPreview(null)
    try {
      const res=await fetch(`/api/directory/${encodeURIComponent(listingId)}/prefill`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,confirmed})})
      const data=await res.json()
      if(!res.ok) throw new Error(isEs?'No se pudo obtener la vista previa. Revisa la dirección HTTPS o introduce los datos manualmente.':data.error || 'Preview unavailable.')
      if(!allowDescription) delete data.fields.description
      setPreview(data);setSelected(Object.keys(data.fields).filter(key=>!current[key as keyof PrefillFields]))
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <section className="rounded-xl border border-brand-neon/30 bg-black/20 p-4 space-y-3">
    <h3 className="font-bold">{isEs?'Completa tu ficha desde tu sitio web':'Fill your listing from your website'}</h3>
    <p className="text-sm text-white/60">{isEs?'Lee una página pública. Tú revisas y eliges qué información guardar; no se inventan datos.':'Read one public page, then review and choose which details to save. Missing details are left blank.'}</p>
    <label className="block text-sm">{isEs?'Sitio web del negocio':'Business website'}<input type="url" value={url} onChange={e=>{setUrl(e.target.value);setPreview(null)}} placeholder="https://" className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2" /></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />{isEs?'Confirmo que este es el sitio de mi negocio y puedo reutilizar estos datos.':'This is my business website and I may reuse these details.'}</label>
    <button type="button" disabled={!confirmed || busy || !url} onClick={inspect} className="rounded bg-brand-neon px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{busy?(isEs?'Leyendo…':'Reading…'):(isEs?'Revisar información':'Preview details')}</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {preview && <div className="space-y-3">
      <p className="text-xs text-white/60">{isEs?'Datos no verificados. Revisa la dirección y el teléfono antes de aplicar.':'Unverified source details. Check the address and phone before applying.'} <a href={preview.source_url} target="_blank" rel="noopener noreferrer" className="text-brand-neon underline">{isEs?'Ver fuente':'View source'}</a></p>
      {Object.entries(preview.fields).map(([key,value])=><label key={key} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={e=>setSelected(list=>e.target.checked?[...list,key]:list.filter(k=>k!==key))} /><span><strong>{labels[key as keyof typeof labels]}:</strong> {value}{current[key as keyof PrefillFields] && <span className="block text-xs text-white/40">{isEs?'Actual: ':'Current: '}{current[key as keyof PrefillFields]}</span>}</span></label>)}
      <button type="button" disabled={!selected.length} className="rounded border border-brand-neon/40 px-4 py-2 text-sm text-brand-neon disabled:opacity-40" onClick={()=>{onApply(Object.fromEntries(Object.entries(preview.fields).filter(([key])=>selected.includes(key))));setPreview(null)}}>{isEs?'Aplicar y guardar seleccionados':'Apply and save selected details'}</button>
    </div>}
  </section>
}
