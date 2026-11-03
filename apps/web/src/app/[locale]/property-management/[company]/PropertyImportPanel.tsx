'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { PROPERTY_TYPES } from '@/lib/apartments'
import type { ImportDraft, PropertyImportFields, ImportField } from '@/lib/property-import'

type Receipt = { id: string; draft: Omit<ImportDraft, 'text'>; source_excerpt: string; baseline: Record<string, unknown>; duplicates: { id: string; name: string }[] }
type Capabilities = { enabled: boolean; website: boolean; brochure: boolean; ai: boolean }
const inputClass = 'w-full min-h-12 rounded-lg border border-white/25 bg-brand-ink px-3 py-3 text-white focus:border-brand-neon focus:outline-none'
const buttonClass = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-neon px-5 py-3 font-black text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40'
const labels: Record<ImportField, [string, string]> = { name: ['Property name', 'Nombre de la propiedad'], property_type: ['Property type', 'Tipo de propiedad'],
  address: ['Street address', 'Dirección'], city: ['City', 'Ciudad'], state: ['State', 'Estado'], zip: ['ZIP code', 'Código postal'],
  phone: ['Leasing phone', 'Teléfono de alquiler'], website: ['Property website', 'Sitio web de la propiedad'],
  description: ['English description', 'Descripción en inglés'], description_es: ['Spanish description', 'Descripción en español'] }
const updateFields = ['phone', 'website', 'description', 'description_es']
function errorText(code: string, es: boolean) {
  const messages: Record<string, [string, string]> = {
    import_disabled: ['Imports are not activated yet. No paid service was called.', 'Las importaciones aún no están activadas. No se llamó a ningún servicio de pago.'],
    import_website_disabled: ['Website importing is not configured yet.', 'La importación de sitios web aún no está configurada.'],
    import_brochure_disabled: ['Brochure importing is not configured yet.', 'La importación de folletos aún no está configurada.'],
    import_worker_unavailable: ['The document could not be converted. Use a text-based PDF or DOCX within the limits; the offline converter may need configuration.', 'No se pudo convertir el documento. Use un PDF con texto o DOCX dentro de los límites; el conversor local puede necesitar configuración.'],
    import_allowance_reached: ['The import allowance is not enabled or has been reached. Contact CityBeat.', 'La cuota de importación no está activada o se agotó. Contacte a CityBeat.'],
    duplicate_property: ['A matching property already exists. Choose its existing listing instead of creating a copy.', 'Ya existe una propiedad coincidente. Seleccione su ficha existente en lugar de crear una copia.'],
    import_listing_changed: ['The listing changed since this preview. Start a new preview to preserve the latest edits.', 'La ficha cambió después de esta vista previa. Inicie otra para conservar las ediciones recientes.'],
    import_draft_expired: ['This draft expired or was already applied. Start a new preview.', 'Este borrador venció o ya se aplicó. Inicie una nueva vista previa.'],
    paid_property_required: ['Descriptions and photo galleries require an active paid listing.', 'Las descripciones y galerías requieren una ficha de pago activa.'],
    try_later: ['Please wait before requesting another import.', 'Espere antes de solicitar otra importación.'],
  }
  return messages[code]?.[es ? 1 : 0] || (es ? 'No se pudo completar la importación. Revise los campos, el formato y los permisos, o contacte a CityBeat.' : 'The import could not be completed. Check the fields, format and permissions, or contact CityBeat.')
}

export default function PropertyImportPanel({ companyId, locale, listings, onSaved, request = fetch }: {
  companyId: string; locale: 'en' | 'es'; listings: { id: string; name: string; status: string; paid: boolean }[];
  onSaved: () => void | Promise<void>; request?: typeof fetch
}) {
  const es = locale === 'es', t = (en: string, spanish: string) => es ? spanish : en
  const endpoint = `/api/property-management/${companyId}/import`
  const [caps, setCaps] = useState<Capabilities | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [target, setTarget] = useState(''), [kind, setKind] = useState<'website' | 'brochure'>('website')
  const [receipt, setReceipt] = useState<Receipt | null>(null), [fields, setFields] = useState<PropertyImportFields | null>(null)
  const [selected, setSelected] = useState<string[]>([]), [photos, setPhotos] = useState<string[]>([]), [rights, setRights] = useState(false), [reviewed, setReviewed] = useState(false)
  useEffect(() => { let active = true
    request(endpoint, { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.code); if (active) setCaps(data) }).catch(e => { if (active) setError(errorText(e.message, es)) })
    return () => { active = false }
  }, [endpoint, es, request])
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget); form.set('kind', kind); form.set('target', target)
    try {
      const response = await request(endpoint, { method: 'POST', body: form }), data = await response.json()
      if (!response.ok) throw new Error(data.code)
      setReceipt(data); setFields(data.draft.fields); setSelected([]); setPhotos([]); setRights(false); setReviewed(false)
    } catch (e) { setError(errorText(e instanceof Error ? e.message : '', es)) } finally { setBusy(false) }
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', id: receipt?.id, fields, selected_fields: selected, photos, photo_rights: rights, reviewed }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.code)
      setReceipt(null); setFields(null); await onSaved()
      setNotice(target ? t('Selected changes saved. Other fields stayed unchanged.', 'Se guardaron los cambios seleccionados. Los demás campos no cambiaron.') : t('Property submitted for review. It is not public and no card was charged.', 'Propiedad enviada a revisión. No es pública y no se realizó ningún cargo.'))
    } catch (e) { setError(errorText(e instanceof Error ? e.message : '', es)) } finally { setBusy(false) }
  }
  function toggle(key: string, checked: boolean) { setSelected(current => checked ? [...new Set([...current, key])] : current.filter(k => k !== key)); setReviewed(false) }
  return <div className="grid gap-5">
    <h3 className="text-xl font-black">{t('Import a property website or brochure', 'Importar sitio web o folleto de una propiedad')}</h3>
    <p className="text-sm leading-6 text-white/65">{t('Create an editable English/Spanish draft for one property at a time. Review missing details, sources and photos before saving. Existing listings change only in fields you select.', 'Cree un borrador editable en inglés y español, una propiedad a la vez. Revise los datos faltantes, fuentes y fotos antes de guardar. Las fichas existentes solo cambian en los campos que seleccione.')}</p>
    {error && <p role="alert" className="rounded-lg border border-red-300/50 p-4 text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-brand-neon/50 p-4 text-brand-neon">{notice}</p>}
    {caps && !caps.enabled && <p role="status" className="rounded-lg border border-amber-200/40 p-4 text-amber-100">{t('Import setup is pending. No import charges are enabled.', 'La configuración de importación está pendiente. No hay cargos de importación activados.')}</p>}
    {!receipt && <form onSubmit={preview} className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-bold sm:col-span-2">{t('Destination', 'Destino')}<select value={target} onChange={e => setTarget(e.target.value)} className={inputClass}>
        <option value="">{t('New property — submit for review', 'Nueva propiedad — enviar a revisión')}</option>{listings.filter(p => p.status === 'approved').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <label className="grid gap-2 text-sm font-bold">{t('Import from', 'Importar desde')}<select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className={inputClass}><option value="website">{t('Property website', 'Sitio web de la propiedad')}</option><option value="brochure">{t('PDF or DOCX brochure', 'Folleto PDF o DOCX')}</option></select></label>
      {kind === 'website' ? <label className="grid gap-2 text-sm font-bold">{t('Public HTTPS website', 'Sitio web público HTTPS')}<input type="url" name="website" placeholder="https://" required maxLength={2000} className={inputClass}/></label> : <label className="grid gap-2 text-sm font-bold">{t('Brochure: up to 10 MiB, 30 PDF pages', 'Folleto: hasta 10 MiB, 30 páginas PDF')}<input type="file" name="brochure" accept=".pdf,.docx" required className={inputClass}/></label>}
      <p className="text-sm text-white/60 sm:col-span-2">{kind === 'website' ? t('Imports one page per request. Use the individual property page; a company directory containing multiple properties needs separate imports.', 'Importa una página por solicitud. Use la página individual de la propiedad; un directorio de empresa con varias propiedades requiere importaciones separadas.') : t('Text-based PDFs and DOCX only. Scanned pages and embedded photos need manual review and separate photo upload.', 'Solo PDF con texto y DOCX. Las páginas escaneadas y fotos incrustadas requieren revisión manual y carga de fotos por separado.')}</p>
      {caps?.ai && <label className="flex gap-3 text-sm sm:col-span-2"><input type="checkbox" name="ai" value="true" className="h-5 w-5"/>{t('Use the approved AI allowance to extract richer details and draft both languages.', 'Usar la cuota de IA aprobada para extraer más detalles y redactar ambos idiomas.')}</label>}
      <button className={`${buttonClass} justify-self-start`} disabled={busy || !caps || !caps[kind]}>{busy ? t('Preparing draft…', 'Preparando borrador…') : t('Prepare draft for review', 'Preparar borrador para revisión')}</button>
    </form>}
    {receipt && fields && <form onSubmit={apply} className="grid gap-5 sm:grid-cols-2">
      <h4 className="text-lg font-bold sm:col-span-2">{target ? `${t('Review changes for', 'Revisar cambios para')}: ${listings.find(p => p.id === target)?.name || target}` : t('Review a new property draft', 'Revisar borrador de nueva propiedad')}</h4>
      <div className="rounded-lg border border-amber-200/40 p-4 text-sm leading-6 text-amber-100 sm:col-span-2">
        <p>{receipt.draft.generation === 'fact_template' ? t('Basic fact templates: the descriptions use recognized facts, not a full translation of the source. Complete and verify both languages.', 'Plantillas de datos básicos: las descripciones usan datos reconocidos, no una traducción completa de la fuente. Complete y verifique ambos idiomas.') : t('AI draft: check every fact and both language versions before saving.', 'Borrador de IA: revise cada dato y ambas versiones antes de guardar.')}</p>
        {receipt.draft.warnings.includes('multiple_properties') && <p>{t('Multiple properties were found. Confirm a single property’s identity and source.', 'Se encontraron varias propiedades. Confirme la identidad y fuente de una sola propiedad.')}</p>}
        {receipt.draft.warnings.filter(w => w.startsWith('conflict:')).map(w => <p key={w}>{t('Conflicting source values:', 'Valores contradictorios en la fuente:')} {labels[w.slice(9) as ImportField]?.[es ? 1 : 0]}</p>)}
        {receipt.duplicates.length > 0 && <p>{t('Possible existing listings:', 'Posibles fichas existentes:')} {receipt.duplicates.map(p => p.name).join(' · ')}. {t('Resolve these before creating a new property.', 'Resuelva estas coincidencias antes de crear una nueva propiedad.')}</p>}
      </div>
      <details className="rounded-lg border border-white/20 p-4 sm:col-span-2"><summary className="cursor-pointer font-bold">{t('Review source and extracted evidence', 'Revisar fuente y datos extraídos')}</summary><p className="mt-3 break-words text-sm">{receipt.draft.source.label} · {receipt.draft.source.observed_at}</p><pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs text-white/70">{receipt.source_excerpt}</pre><dl className="mt-3 text-sm">{Object.entries(receipt.draft.evidence).map(([key, values]) => <div key={key}><dt className="font-bold">{labels[key as ImportField]?.[es ? 1 : 0] || t('Listed amenities', 'Amenidades indicadas')}</dt><dd className="break-words">{values.join(' / ')}</dd></div>)}</dl></details>
      {(Object.keys(labels) as ImportField[]).map(key => {
        const canUpdate = updateFields.includes(key), disabled = Boolean(target && (!canUpdate || !selected.includes(key)))
        return <div key={key} className="grid content-start gap-2 text-sm">
          {target && canUpdate && <label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(key)} onChange={e => toggle(key, e.target.checked)} className="h-5 w-5"/>{t('Replace this field', 'Reemplazar este campo')}</label>}
          <label className="grid gap-2 font-bold">{labels[key][es ? 1 : 0]}{key === 'property_type' ? <select required disabled={disabled} value={fields[key]} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setReviewed(false) }} className={inputClass}><option value="">{t('Choose property type', 'Seleccione tipo de propiedad')}</option>{Object.entries(PROPERTY_TYPES).map(([value, label]) => <option key={value} value={value}>{label[locale]}</option>)}</select> : key.startsWith('description') ? <textarea required disabled={disabled} value={fields[key]} rows={5} maxLength={4000} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setReviewed(false) }} className={inputClass}/> : <input required={key !== 'website'} disabled={disabled} value={fields[key]} type={key === 'website' ? 'url' : key === 'phone' ? 'tel' : 'text'} maxLength={key === 'website' ? 500 : key === 'state' ? 2 : key === 'zip' ? 10 : key === 'phone' ? 30 : key === 'name' ? 160 : key === 'address' ? 250 : 100} onChange={e => { setFields({ ...fields, [key]: e.target.value }); setReviewed(false) }} className={inputClass}/>}</label>
          {target && canUpdate && <p className="whitespace-pre-wrap break-words text-xs text-white/55">{t('Current:', 'Actual:')} {String(receipt.baseline[key] || t('(empty)', '(vacío)'))}</p>}
        </div>
      })}
      {receipt.draft.photos.length > 0 && <fieldset className="grid gap-3 rounded-lg border border-white/20 p-4 sm:col-span-2"><legend className="px-2 font-bold">{t('Photo candidates — review before selecting', 'Fotos candidatas — revisar antes de seleccionar')}</legend>
        {target && <label className="flex gap-3 text-sm"><input type="checkbox" checked={selected.includes('gallery_urls')} onChange={e => toggle('gallery_urls', e.target.checked)} className="h-5 w-5"/>{t('Replace the existing gallery with selected photos', 'Reemplazar la galería existente con las fotos seleccionadas')}</label>}
        {receipt.draft.photos.map((url, i) => <div key={url} className="flex items-start gap-3"><input type="checkbox" aria-label={`${t('Select photo', 'Seleccionar foto')} ${i + 1}`} checked={photos.includes(url)} disabled={!!target && !selected.includes('gallery_urls')} onChange={e => { setPhotos(current => e.target.checked ? [...current, url] : current.filter(p => p !== url)); setReviewed(false) }} className="mt-1 h-5 w-5 shrink-0"/><a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-brand-neon underline">{t('Review photo', 'Revisar foto')} {i + 1}: {url}</a></div>)}
        {photos.length > 0 && <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={rights} onChange={e => { setRights(e.target.checked); setReviewed(false) }} className="mt-1 h-5 w-5 shrink-0"/>{t('I have permission to publish these photos, and they accurately show this property.', 'Tengo permiso para publicar estas fotos y representan correctamente esta propiedad.')}</label>}
      </fieldset>}
      <label className="flex items-start gap-3 text-sm leading-6 sm:col-span-2"><input type="checkbox" required checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/>{t('I checked the property identity, source, duplicates, photos and both languages. I approve only the fields selected above.', 'Revisé la identidad de la propiedad, fuente, duplicados, fotos y ambos idiomas. Apruebo solo los campos seleccionados arriba.')}</label>
      <p className="text-sm text-white/60 sm:col-span-2">{target ? t('Saved changes affect the existing listing. Unselected fields, ownership and billing stay unchanged. Paid features still require an active paid listing.', 'Los cambios guardados afectan la ficha existente. Los campos no seleccionados, titularidad y facturación no cambian. Las funciones de pago requieren una ficha de pago activa.') : t('New properties stay private pending staff review and paid enrollment. Saving does not charge your card.', 'Las propiedades nuevas permanecen privadas hasta la revisión y la inscripción de pago. Guardar no genera cargos a su tarjeta.')}</p>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={busy || !reviewed || !!target && !selected.length || photos.length > 0 && !rights} className={buttonClass}>{busy ? t('Saving…', 'Guardando…') : target ? t('Apply selected changes', 'Aplicar cambios seleccionados') : t('Submit new property for review', 'Enviar nueva propiedad a revisión')}</button><button type="button" disabled={busy} onClick={() => { setReceipt(null); setFields(null); setError('') }} className="min-h-12 rounded-lg border border-white/30 px-5 font-bold">{t('Discard draft / start again', 'Descartar borrador / empezar de nuevo')}</button></div>
    </form>}
  </div>
}
