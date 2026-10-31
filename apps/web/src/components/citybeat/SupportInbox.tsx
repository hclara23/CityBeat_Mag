'use client'
import {useCallback,useEffect,useState} from 'react'
import {SUPPORT_STATUSES} from '@/lib/support-workflow'
type Ticket={id:string;name:string;contact:string;message:string;business_name?:string;source:string;created_at:number;support_status:string;support_assigned_to:string|null;support_assigned_name:string|null;support_note:string;support_revision:number;support_updated_at:string|null}
const names={en:{open:'Open',in_progress:'In progress',waiting:'Waiting on customer',resolved:'Resolved'},es:{open:'Abierto',in_progress:'En proceso',waiting:'Esperando al cliente',resolved:'Resuelto'}}
function TicketCard({ticket,isEs,onSaved,onReload}:{ticket:Ticket;isEs:boolean;onSaved:(patch:any)=>void;onReload:()=>void}) {
  const [status,setStatus]=useState(ticket.support_status),[assignment,setAssignment]=useState('keep'),[note,setNote]=useState(ticket.support_note)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const labels=isEs?names.es:names.en
  const save=async()=>{
    setBusy(true);setError('')
    try{
      const res=await fetch(`/api/admin/leads/${encodeURIComponent(ticket.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,assignment,note,expected_revision:ticket.support_revision})})
      const body=await res.json()
      if(!res.ok) throw new Error(body.error || 'Could not save')
      onSaved(body);setAssignment('keep')
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  return <article className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{ticket.name} <span className="font-normal text-white/60">· {ticket.contact}</span></h3><span className="text-xs text-brand-neon">{labels[ticket.support_status as keyof typeof labels]}</span></div>
    <p className="text-xs text-white/50">{ticket.business_name || (ticket.source==='manual_email'?(isEs?'Correo registrado manualmente':'Manually logged email'):(isEs?'Contacto directo':'Direct contact'))} · {ticket.created_at?new Date(ticket.created_at).toLocaleString(isEs?'es-US':'en-US'):''}</p>
    <p className="whitespace-pre-wrap break-words text-sm text-white/75">{ticket.message}</p>
    <p className="text-xs text-white/60">{isEs?'Responsable':'Assigned to'}: {ticket.support_assigned_name || (isEs?'Sin asignar':'Unassigned')}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">{isEs?'Asignación':'Assignment'}<select className="mt-1 block w-full rounded border border-white/20 bg-black p-2" value={assignment} onChange={e=>setAssignment(e.target.value)}><option value="keep">{isEs?'Mantener responsable':'Keep current assignment'}</option><option value="me">{isEs?'Asignarme':'Assign to me'}</option><option value="unassigned">{isEs?'Sin asignar':'Unassign'}</option></select></label>
      <label className="text-sm">{isEs?'Estado':'Status'}<select className="mt-1 block w-full rounded border border-white/20 bg-black p-2" value={status} onChange={e=>setStatus(e.target.value)}>{SUPPORT_STATUSES.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select></label>
    </div>
    <label className="block text-sm">{isEs?'Nota interna / resolución':'Internal note / resolution'}<textarea maxLength={2000} rows={2} value={note} onChange={e=>setNote(e.target.value)} className="mt-1 w-full rounded border border-white/20 bg-black/30 p-2" /></label>
    <button type="button" disabled={busy} onClick={save} className="rounded bg-brand-neon px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{busy?(isEs?'Guardando…':'Saving…'):(isEs?'Guardar seguimiento':'Save follow-up')}</button>
    {ticket.support_updated_at && <span className="ml-3 text-xs text-white/45">{isEs?'Actualizado':'Updated'} {new Date(ticket.support_updated_at).toLocaleString()}</span>}
    {error && <p role="alert" className="text-sm text-red-300">{error} <button onClick={onReload} className="underline">{isEs?'Recargar':'Reload'}</button></p>}
  </article>
}
export function SupportInbox({locale}:{locale:'en'|'es'}) {
  const isEs=locale==='es'
  const [tickets,setTickets]=useState<Ticket[]>([]),[viewer,setViewer]=useState(''),[capped,setCapped]=useState(false)
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[mine,setMine]=useState(false)
  const [search,setSearch]=useState(''),[logging,setLogging]=useState(false),[logError,setLogError]=useState('')
  const [requestId,setRequestId]=useState('')
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/admin/leads',{cache:'no-store'}),data=await res.json()
      if(!res.ok) throw new Error(data.error || 'Could not load customer requests.')
      setTickets(data.leads);setViewer(data.viewer_id);setCapped(data.capped)
    }catch(e){setError((e as Error).message)}finally{setLoading(false)}
  },[])
  useEffect(()=>{void load();setRequestId(crypto.randomUUID())},[load])
  const logReply=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form)
    setLogging(true);setLogError('')
    try{
      const res=await fetch('/api/admin/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(data),request_id:requestId})})
      const result=await res.json();if(!res.ok) throw new Error(result.error || 'Could not log reply.')
      form.reset();setRequestId(crypto.randomUUID());await load()
    }catch(e){setLogError((e as Error).message)}finally{setLogging(false)}
  }
  const visible=tickets.filter(t=>(filter==='all'||t.support_status===filter)&&(!mine||t.support_assigned_to===viewer)&&`${t.name} ${t.contact} ${t.business_name || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="mt-8 space-y-4">
    <h2 className="text-2xl font-bold">{isEs?'Seguimiento de clientes':'Customer follow-up'}</h2>
    <p className="text-sm text-white/60">{isEs?'Asigna un responsable y registra la resolución. Los formularios llegan aquí; las respuestas por correo siguen en el buzón y se registran manualmente.':'Assign a responsible person and record the resolution. Website forms appear here; email replies remain in the mailbox and must be logged manually.'}</p>
    <details className="rounded-xl border border-white/10 p-4"><summary className="cursor-pointer font-bold text-brand-neon">{isEs?'Registrar respuesta por correo':'Log an email reply'}</summary>
      <form onSubmit={logReply} className="mt-3 space-y-3">
        <p className="text-xs text-white/55">{isEs?'Se te asignará este seguimiento. Esto no envía ningún correo.':'This follow-up will be assigned to you. Saving does not send an email.'}</p>
        <label className="block text-sm">{isEs?'Nombre del cliente':'Customer name'}<input name="name" required maxLength={120} className="mt-1 block w-full rounded border border-white/20 bg-black/30 p-2" /></label>
        <label className="block text-sm">{isEs?'Correo o teléfono':'Email or phone'}<input name="contact" required maxLength={200} className="mt-1 block w-full rounded border border-white/20 bg-black/30 p-2" /></label>
        <label className="block text-sm">{isEs?'Mensaje o resumen':'Message or summary'}<textarea name="message" required minLength={5} maxLength={4000} rows={3} className="mt-1 block w-full rounded border border-white/20 bg-black/30 p-2" /></label>
        <button disabled={logging || !requestId} className="rounded bg-brand-neon px-4 py-2 font-bold text-black disabled:opacity-40">{logging?(isEs?'Guardando…':'Saving…'):(isEs?'Registrar respuesta':'Log reply')}</button>
        {logError&&<p role="alert" className="text-red-300">{logError}</p>}
      </form>
    </details>
    <div className="flex flex-wrap items-center gap-3">
      <input aria-label={isEs?'Buscar solicitudes':'Search requests'} placeholder={isEs?'Buscar nombre o contacto':'Search name or contact'} value={search} onChange={e=>setSearch(e.target.value)} className="rounded border border-white/20 bg-black/30 p-2 text-sm" />
      <select aria-label={isEs?'Filtrar estado':'Filter status'} value={filter} onChange={e=>setFilter(e.target.value)} className="rounded border border-white/20 bg-black p-2 text-sm"><option value="all">{isEs?'Todos los estados':'All statuses'}</option>{SUPPORT_STATUSES.map(s=><option key={s} value={s}>{names[locale][s]}</option>)}</select>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)} />{isEs?'Asignados a mí':'Assigned to me'}</label>
      <button onClick={load} disabled={loading} className="text-sm text-brand-neon underline">{isEs?'Actualizar':'Refresh'}</button>
    </div>
    {capped&&<p className="text-xs text-amber-300">{isEs?'Se muestran hasta 200 solicitudes recientes; los filtros se aplican a estas solicitudes.':'Showing up to 200 recent requests; filters apply to this displayed set.'}</p>}
    {loading?<p role="status">{isEs?'Cargando solicitudes…':'Loading requests…'}</p>:error?<p role="alert" className="text-red-300">{error}</p>:visible.length===0?<p className="text-sm text-white/60">{isEs?'No hay solicitudes para este filtro.':'No requests match this filter.'}</p>:visible.map(ticket=><TicketCard key={`${ticket.id}:${ticket.support_revision}`} ticket={ticket} isEs={isEs} onReload={load} onSaved={patch=>setTickets(list=>list.map(t=>t.id===ticket.id?{...t,...patch}:t))} />)}
  </section>
}
