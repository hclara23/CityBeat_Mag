'use client'
import {useCallback,useEffect,useState} from 'react'
import {useLocale} from '@/components/TranslationProvider'
type Listing={id:string;name:string;city:string}
type Draft={id:string;listing_name:string;caption:string;status:string;scheduled_at?:string;postiz_post_id?:string}
type Workbench={configured:boolean;connection_error:boolean;channels:{id:string;name:string}[];listings:Listing[];drafts:Draft[]}
export function PromotionWorkbench(){
  const locale=useLocale()==='es'?'es':'en',isEs=locale==='es'
  const [data,setData]=useState<Workbench|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const [listing,setListing]=useState(''),[caption,setCaption]=useState(''),[requestId,setRequestId]=useState('')
  const [draft,setDraft]=useState(''),[channel,setChannel]=useState(''),[date,setDate]=useState(''),[approved,setApproved]=useState(false)
  const load=useCallback(async()=>{try{const res=await fetch('/api/admin/promotions',{cache:'no-store'}),body=await res.json();if(!res.ok)throw new Error(body.error);setData(body);setError('')}catch(e){setError((e as Error).message)}},[])
  useEffect(()=>{void load()},[load])
  useEffect(()=>{setRequestId(crypto.randomUUID())},[listing,caption])
  useEffect(()=>{setApproved(false)},[draft,channel,date])
  const selected=data?.drafts.find(d=>d.id===draft)
  const submit=async(action:'save'|'schedule')=>{
    setBusy(true);setMessage('');setError('')
    try{
      const body=action==='save'?{action,listing_id:listing,caption,locale,request_id:requestId}:{action,draft_id:draft,channel_id:channel,date:new Date(date).toISOString(),approved}
      const res=await fetch('/api/admin/promotions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),result=await res.json()
      if(!res.ok)throw new Error(result.error || 'Could not save promotion.')
      if(action==='save'){setDraft(result.id);setRequestId(crypto.randomUUID())}
      setMessage(action==='save'?(isEs?'Borrador guardado; no se publicó nada.':'Draft saved; nothing was published.'):(isEs?'Postiz aceptó la programación. Verifica la entrega final en Postiz.':'Postiz accepted the schedule. Verify final delivery in Postiz.'))
      setApproved(false);await load()
    }catch(e){await load();setError((e as Error).message)}finally{setBusy(false)}
  }
  return <section className="my-8 rounded-2xl border border-brand-neon/30 bg-black/20 p-5 space-y-4">
    <h2 className="text-2xl font-bold">{isEs?'Promoción de negocios locales':'Local business promotion'}</h2>
    <p className="text-sm text-white/60">{isEs?'Prepara un borrador para una ficha Premium publicada. Revisa el texto antes de programarlo.':'Prepare a draft for a published Premium listing. Review the exact caption before scheduling.'}</p>
    {error&&<p role="alert" className="text-red-300">{error} <button onClick={load} className="underline">{isEs?'Actualizar':'Refresh'}</button></p>}
    {!data?(error?null:<p>{isEs?'Cargando…':'Loading…'}</p>):<>
      <p className="text-sm text-white/70">{data.connection_error?(isEs?'La conexión con Postiz necesita atención. Los borradores locales siguen disponibles.':'The Postiz connection needs attention. Local drafts remain available.'):data.configured?(isEs?`Postiz conectado: ${data.channels.length} páginas de Facebook disponibles.`:`Postiz connected: ${data.channels.length} Facebook pages available.`):(isEs?'Postiz aún no está conectado. Puedes preparar borradores locales sin publicarlos.':'Postiz is not connected yet. You can prepare local drafts without publishing.')}</p>
      <label className="block text-sm">{isEs?'Ficha':'Listing'}<select disabled={busy} value={listing} onChange={e=>{setListing(e.target.value);setCaption('')}} className="mt-1 w-full rounded border border-white/20 bg-black p-2"><option value="">{isEs?'Selecciona un negocio':'Choose a business'}</option>{data.listings.map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label>
      <label className="block text-sm">{isEs?'Texto opcional; déjalo vacío para crear una presentación factual':'Optional caption; leave blank for a factual introduction'}<textarea disabled={busy} value={caption} maxLength={1500} onChange={e=>setCaption(e.target.value)} rows={3} className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2" /></label>
      <button disabled={busy || !listing || !requestId} onClick={()=>submit('save')} className="rounded bg-brand-neon px-4 py-2 font-bold text-black disabled:opacity-40">{isEs?'Guardar borrador local':'Save local draft'}</button>
      <details className="border-t border-white/10 pt-4" open={Boolean(selected)}><summary className="cursor-pointer font-bold">{isEs?'Revisar y programar en Postiz':'Review and schedule in Postiz'}</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">{isEs?'Borrador guardado':'Saved draft'}<select value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black p-2"><option value="">{isEs?'Selecciona un borrador':'Choose a draft'}</option>{data.drafts.filter(d=>d.status==='draft').map(d=><option key={d.id} value={d.id}>{d.listing_name} · {d.id.slice(0,8)}</option>)}</select></label>
          {selected&&<pre className="whitespace-pre-wrap break-words rounded bg-white/5 p-3 text-sm">{selected.caption}</pre>}
          <label className="block text-sm">{isEs?'Página de Facebook conectada':'Connected Facebook page'}<select disabled={busy || !data.configured} value={channel} onChange={e=>setChannel(e.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black p-2"><option value="">{isEs?'Selecciona una página':'Choose a page'}</option>{data.channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block text-sm">{isEs?'Fecha y hora en la zona horaria de tu dispositivo':'Date and time in your device timezone'}<input type="datetime-local" value={date} disabled={busy} onChange={e=>setDate(e.target.value)} className="mt-1 block rounded border border-white/20 bg-black p-2" /></label>
          {date&&Number.isFinite(Date.parse(date))&&<p className="text-xs text-white/60">{new Date(date).toLocaleString()} · UTC {new Date(date).toISOString()}</p>}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={approved} disabled={busy || !selected} onChange={e=>setApproved(e.target.checked)} />{isEs?'Apruebo este texto exacto, tengo permiso para publicarlo y confirmo la página y la hora.':'I approve this exact caption, have permission to publish it, and confirm the page and time.'}</label>
          <button disabled={busy || !approved || !selected || selected.status!=='draft' || !channel || !date || !data.configured || data.connection_error} onClick={()=>submit('schedule')} className="rounded border border-brand-neon/40 px-4 py-2 font-bold text-brand-neon disabled:opacity-40">{isEs?'Programar publicación':'Schedule post'}</button>
        </div>
      </details>
      {message&&<p role="status" className="text-brand-neon">{message}</p>}
      <ul className="space-y-2 text-sm">{data.drafts.slice(0,10).map(d=><li key={d.id} className="rounded border border-white/10 p-2"><strong>{d.listing_name}</strong> · {d.status==='draft'?(isEs?'Borrador local':'Local draft'):d.status==='accepted_by_postiz'?(isEs?'Aceptado por Postiz; entrega sin verificar':'Accepted by Postiz; delivery unverified'):(isEs?'Revisar en Postiz antes de reintentar':'Check Postiz before retrying')}{d.scheduled_at&&` · ${new Date(d.scheduled_at).toLocaleString()}`}</li>)}</ul>
    </>}
  </section>
}
