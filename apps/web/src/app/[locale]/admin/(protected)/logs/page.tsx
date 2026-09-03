'use client'

import { useCallback, useEffect, useState } from 'react'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

// Operator console for the two observability surfaces: bugs that reported
// themselves, and the auditable record of every AI generation.

interface ErrorRow {
  fingerprint: string
  message: string
  stack: string
  source: string
  severity: 'critical' | 'error'
  status: string
  count: number
  routes: string[]
  releases: string[]
  first_seen_at: string | null
  last_seen_at: string | null
}

interface AiRow {
  id: string
  purpose: string
  model: string
  input: string
  output: string
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  subject: Record<string, unknown> | null
  ok: boolean
  error: string | null
  created_at: string | null
  content_hash: string | null
  integrity_ok: boolean
}

interface Data {
  errors: ErrorRow[]
  ai: AiRow[]
  summary: {
    open_errors: number
    critical_errors: number
    total_occurrences: number
    ai_records: number
    ai_integrity_failures: number
  }
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')

export default function LogsPage() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [data, setData] = useState<Data | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'denied'>('loading')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<'bugs' | 'ai'>('bugs')
  const [open, setOpen] = useState<string>('')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/admin/observability', { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setState('denied')
        return
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'request failed')
      setData(json)
      setState('ok')
    } catch (e: any) {
      setErr(e.message)
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolve = async (fingerprint: string, status: 'resolved' | 'open') => {
    await fetch('/api/admin/observability', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, status }),
    }).catch(() => {})
    load()
  }

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide py-10">
        <h1 className="font-display text-3xl font-black text-white">
          {isEs ? 'Registros y auditoría' : 'Logs & audit'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">
          {isEs
            ? 'Errores que se reportan solos (agrupados por huella) y el registro auditable de cada generación de IA.'
            : 'Bugs that report themselves (grouped by fingerprint) and the auditable record of every AI generation.'}
        </p>

        {state === 'denied' && (
          <p className="mt-6 text-sm text-white/50">
            {isEs ? 'Necesitas acceso de staff con 2FA.' : 'Staff access with 2FA required.'}
          </p>
        )}
        {state === 'error' && (
          <div className="mt-6 flex items-center gap-3">
            <p className="text-sm text-red-300">{err}</p>
            <button onClick={load} className="rounded border border-white/20 px-3 py-1 text-xs font-bold text-white/70">
              {isEs ? 'Reintentar' : 'Retry'}
            </button>
          </div>
        )}
        {state === 'loading' && !data && <p className="mt-6 text-sm text-white/40">{isEs ? 'Cargando…' : 'Loading…'}</p>}

        {data && (
          <>
            <div className="mt-6 flex flex-wrap gap-5">
              {[
                [data.summary.critical_errors, isEs ? 'Críticos' : 'Critical', 'text-red-300'],
                [data.summary.open_errors, isEs ? 'Abiertos' : 'Open bugs', 'text-white'],
                [data.summary.total_occurrences, isEs ? 'Ocurrencias' : 'Occurrences', 'text-white/70'],
                [data.summary.ai_records, isEs ? 'Registros IA' : 'AI records', 'text-white/70'],
                [
                  data.summary.ai_integrity_failures,
                  isEs ? 'Integridad fallida' : 'Integrity failures',
                  data.summary.ai_integrity_failures > 0 ? 'text-red-300' : 'text-emerald-300',
                ],
              ].map(([n, label, cls]) => (
                <div key={String(label)}>
                  <p className={`text-3xl font-black ${cls}`}>{String(n)}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{String(label)}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex gap-2">
              {(['bugs', 'ai'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    tab === t ? 'bg-brand-neon text-black' : 'border border-white/15 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {t === 'bugs' ? (isEs ? 'Errores' : 'Bugs') : isEs ? 'Auditoría IA' : 'AI audit'}
                </button>
              ))}
            </div>

            {tab === 'bugs' && (
              <div className="mt-4 space-y-3">
                {data.errors.length === 0 && (
                  <p className="text-sm text-white/40">{isEs ? 'Sin errores registrados.' : 'No errors recorded.'}</p>
                )}
                {data.errors.map((e) => (
                  <div
                    key={e.fingerprint}
                    className={`rounded-xl border p-4 ${
                      e.status === 'resolved'
                        ? 'border-white/10 bg-white/[0.02] opacity-60'
                        : e.severity === 'critical'
                          ? 'border-red-400/30 bg-red-400/[0.05]'
                          : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/60">
                            {e.source}
                          </span>
                          {e.severity === 'critical' && (
                            <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
                              critical
                            </span>
                          )}
                          {e.status === 'regressed' && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                              {isEs ? 'reapareció' : 'regressed'}
                            </span>
                          )}
                          <span className="break-words">{e.message}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">
                          ×{e.count} · {isEs ? 'primera' : 'first'} {when(e.first_seen_at)} · {isEs ? 'última' : 'last'}{' '}
                          {when(e.last_seen_at)}
                          {e.routes.length > 0 && ` · ${e.routes.join(', ')}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => setOpen(open === e.fingerprint ? '' : e.fingerprint)}
                          className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold text-white/60 hover:bg-white/10"
                        >
                          {isEs ? 'Traza' : 'Stack'}
                        </button>
                        <button
                          onClick={() => resolve(e.fingerprint, e.status === 'resolved' ? 'open' : 'resolved')}
                          className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold text-white/60 hover:bg-white/10"
                        >
                          {e.status === 'resolved' ? (isEs ? 'Reabrir' : 'Reopen') : isEs ? 'Resolver' : 'Resolve'}
                        </button>
                      </div>
                    </div>
                    {open === e.fingerprint && (
                      <pre className="mt-3 max-h-64 overflow-auto rounded bg-black/40 p-3 text-[11px] leading-4 text-white/60">
                        {e.stack || (isEs ? '(sin traza)' : '(no stack)')}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'ai' && (
              <div className="mt-4 space-y-3">
                {data.ai.length === 0 && (
                  <p className="text-sm text-white/40">
                    {isEs ? 'Sin generaciones registradas todavía.' : 'No generations recorded yet.'}
                  </p>
                )}
                {data.ai.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                        <span className="rounded bg-brand-neon/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-neon">
                          {r.purpose}
                        </span>
                        <span className="text-white/50">{r.model}</span>
                        {!r.ok && (
                          <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
                            {r.error || 'failed'}
                          </span>
                        )}
                        <span
                          title={r.content_hash || ''}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                            r.integrity_ok ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/20 text-red-300'
                          }`}
                        >
                          {r.integrity_ok ? (isEs ? 'íntegro' : 'verified') : isEs ? 'alterado' : 'altered'}
                        </span>
                      </p>
                      <p className="text-[11px] text-white/35">
                        {when(r.created_at)}
                        {r.latency_ms !== null && ` · ${r.latency_ms}ms`}
                        {r.input_tokens !== null && ` · ${r.input_tokens}+${r.output_tokens ?? 0} tok`}
                      </p>
                    </div>
                    {r.subject && (
                      <p className="mt-1 text-[11px] text-white/40">
                        {Object.entries(r.subject)
                          .map(([k, v]) => `${k}=${String(v).slice(0, 60)}`)
                          .join(' · ')}
                      </p>
                    )}
                    <button
                      onClick={() => setOpen(open === r.id ? '' : r.id)}
                      className="mt-2 rounded border border-white/15 px-2 py-1 text-[11px] font-bold text-white/60 hover:bg-white/10"
                    >
                      {open === r.id ? (isEs ? 'Ocultar' : 'Hide') : isEs ? 'Ver prompt y salida' : 'View prompt & output'}
                    </button>
                    {open === r.id && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                            {isEs ? 'Entrada' : 'Input'}
                          </p>
                          <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-[11px] leading-4 text-white/60">
                            {r.input || '—'}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-white/40">
                            {isEs ? 'Salida' : 'Output'}
                          </p>
                          <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-[11px] leading-4 text-white/70">
                            {r.output || '—'}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </CityBeatShell>
  )
}
