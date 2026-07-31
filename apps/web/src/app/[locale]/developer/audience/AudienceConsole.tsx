'use client'

import { useCallback, useEffect, useState } from 'react'
import { AUDIENCE_COLUMNS, AUDIENCE_DATASETS, type AudienceRow } from '@/lib/audience'

export function AudienceConsole({ locale }: { locale: 'en' | 'es' }) {
  const isEs = locale === 'es'
  const [dataset, setDataset] = useState<string>('profiles')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<AudienceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const pageSize = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/developer/audience?dataset=${dataset}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`,
        { cache: 'no-store' }
      )
      if (res.status === 403) {
        setForbidden(true)
        return
      }
      const data = await res.json()
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dataset, q, page])

  useEffect(() => {
    void load()
  }, [load])

  if (forbidden) {
    return <p className="text-sm text-red-400">{isEs ? 'Acceso denegado.' : 'Access denied.'}</p>
  }

  const csvHref = `/api/developer/audience?dataset=${dataset}&q=${encodeURIComponent(q)}&format=csv`
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-black uppercase tracking-wider text-white/50">
          {isEs ? 'Conjunto de datos' : 'Dataset'}
          <select
            value={dataset}
            onChange={(e) => {
              setDataset(e.target.value)
              setPage(0)
            }}
            className="mt-1.5 block rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          >
            {AUDIENCE_DATASETS.map((d) => (
              <option key={d.key} value={d.key}>
                {isEs ? d.es : d.en}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-black uppercase tracking-wider text-white/50">
          {isEs ? 'Buscar' : 'Search'}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder={isEs ? 'nombre, correo, ID…' : 'name, email, id…'}
            className="mt-1.5 block rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        <a
          href={csvHref}
          className="rounded-md border border-brand-neon/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon/10"
        >
          {isEs ? '⬇ Exportar CSV' : '⬇ Export CSV'}
        </a>
        <span className="text-xs text-white/40">
          {total.toLocaleString()} {isEs ? 'registros' : 'records'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              {AUDIENCE_COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-black">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={AUDIENCE_COLUMNS.length} className="px-3 py-8 text-center text-white/40">
                  {isEs ? 'Cargando…' : 'Loading…'}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={AUDIENCE_COLUMNS.length} className="px-3 py-8 text-center text-white/40">
                  {isEs ? 'Sin resultados.' : 'No records.'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/[0.03]">
                  {AUDIENCE_COLUMNS.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 text-white/70">
                      {row[c.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded border border-white/15 px-3 py-1.5 disabled:opacity-30"
        >
          ← {isEs ? 'Anterior' : 'Prev'}
        </button>
        <span>
          {isEs ? 'Página' : 'Page'} {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-white/15 px-3 py-1.5 disabled:opacity-30"
        >
          {isEs ? 'Siguiente' : 'Next'} →
        </button>
      </div>
    </div>
  )
}
