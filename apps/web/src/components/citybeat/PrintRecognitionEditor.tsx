'use client'
import { PRINT_LABELS, PRINT_TYPES, type PrintRecognition } from '@/lib/print-recognition'

export function PrintRecognitionEditor({ value, onChange }: { value: PrintRecognition[]; onChange: (value: PrintRecognition[]) => void }) {
  function update(index: number, field: keyof PrintRecognition, text: string) {
    onChange(value.map((row, i) => i === index ? { ...row, [field]: text } : row))
  }
  return <fieldset className="space-y-4 rounded-xl border border-brand-gold/30 p-4">
    <legend className="px-2 text-sm font-bold text-brand-gold">Print magazine recognition · CityBeat staff only</legend>
    <p className="text-xs text-white/60">Record confirmed print appearances. Advertising is distinct from editorial coverage. Cover Feature receives the highest visual prominence; it is not a paid listing tier.</p>
    {value.map((row, index) => <div key={row.id} className="space-y-3 rounded-lg border border-white/15 p-3">
      <label className="block text-xs">Appearance type<select value={row.type} onChange={e => update(index, 'type', e.target.value)} className="mt-1 block w-full rounded bg-brand-dark p-2 text-white">{PRINT_TYPES.map(type => <option key={type} value={type}>{PRINT_LABELS[type].en}</option>)}</select></label>
      {([['issue', 'Issue label (required)'], ['issue_es', 'Issue label — Spanish'], ['title', 'Headline / feature title'], ['title_es', 'Headline — Spanish'], ['image_url', 'Historical cover / artwork URL (optional)'], ['issue_url', 'Read issue URL (optional)']] as const).map(([field, label]) => <label key={field} className="block text-xs">{label}<input value={row[field]} maxLength={field.endsWith('url') ? 500 : 180} onChange={e => update(index, field, e.target.value)} className="mt-1 block w-full rounded border border-white/15 bg-black/40 p-2 text-white" /></label>)}
      <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-xs text-brand-magenta">Remove appearance</button>
    </div>)}
    {value.length < 20 && <button type="button" onClick={() => onChange([...value, { id: crypto.randomUUID(), type: 'editorial', issue: '', issue_es: '', title: '', title_es: '', image_url: '', issue_url: '' }])} className="rounded border border-brand-gold/40 px-3 py-2 text-xs font-bold text-brand-gold">Add print appearance</button>}
  </fieldset>
}
