'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

// First-touch A/B scoreboard: which opening email actually produces claims,
// including the two mirror arms (Spanish description / accuracy audit).
//
// The panel is deliberately cautious about what it lets an operator conclude.
// Significance styling appears only for arms that are POWERED (enough volume for
// the comparison to mean something), never merely non-empty; comparisons are
// against a matched control cohort; and the window control exists because the
// mirror arms launched later than the subject arms.

interface Arm {
  key: number
  label: string
  label_es: string
  note: string
  note_es: string
  delivered: number
  opened: number
  clicked: number
  converted: number
  unsubscribed: number
  in_flight: number
  open_rate: number
  click_rate: number
  conversion_rate: number
  unsub_rate: number
  conversion_ci: [number, number]
  matched_control_n: number
  matched_control_rate: number
  comparable: boolean
  p_vs_control: number | null
  lift_vs_control: number | null
  better_than_control: boolean
  required_n: number
  displayable: boolean
  powered: boolean
  first_sent_ms: number | null
  last_sent_ms: number | null
}

interface Board {
  arms: Arm[]
  totals: { delivered: number; opened: number; clicked: number; converted: number; in_flight: number }
  verdict: { status: 'insufficient_data' | 'no_difference' | 'winner'; winner: number | null; message: string; message_es: string }
  min_display: number
  alpha: number
  excluded_downgraded: number
  unbucketed: number
  aligned_since_ms: number | null
  scanned: number
  as_of?: string
}

type State = 'loading' | 'ok' | 'error' | 'denied'

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const fmtP = (p: number) => (p < 0.001 ? '<0.001' : p.toFixed(3))

export function VariantScoreboard() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [board, setBoard] = useState<Board | null>(null)
  const [state, setState] = useState<State>('loading')
  const [error, setError] = useState('')
  const [aligned, setAligned] = useState(false)

  const load = useCallback(
    async (sinceMs: number | null) => {
      setState('loading')
      setError('')
      try {
        const qs = sinceMs ? `?since=${new Date(sinceMs).toISOString().slice(0, 10)}` : ''
        const res = await fetch(`/api/admin/outreach-variants${qs}`, { cache: 'no-store' })
        if (res.status === 401 || res.status === 403) {
          setState('denied')
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'request failed')
        setBoard(data)
        setState('ok')
      } catch (e: any) {
        setError(e.message || 'unknown error')
        setState('error')
      }
    },
    []
  )

  useEffect(() => {
    load(null)
  }, [load])

  // Access denial is the only state that renders nothing — every other failure
  // must be visible, or "the endpoint is broken" looks identical to "no data".
  if (state === 'denied') return null

  const shell = (children: React.ReactNode) => (
    <section className="mb-10 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="text-xl font-bold text-white">
        {isEs ? 'Prueba A/B: primer correo' : 'A/B scoreboard: first-touch email'}
      </h2>
      {children}
    </section>
  )

  if (state === 'loading' && !board) return shell(<p className="mt-3 text-sm text-white/40">{isEs ? 'Cargando…' : 'Loading…'}</p>)

  if (state === 'error') {
    return shell(
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-red-300">
          {isEs ? 'Marcador no disponible' : 'Scoreboard unavailable'} — {error}
        </p>
        <button
          onClick={() => load(aligned && board?.aligned_since_ms ? board.aligned_since_ms : null)}
          className="rounded border border-white/20 px-3 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
        >
          {isEs ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    )
  }

  if (!board) return null
  if (board.totals.delivered === 0 && board.totals.in_flight === 0) {
    return shell(
      <p className="mt-3 text-sm text-white/40">
        {isEs ? 'Todavía no hay envíos medibles.' : 'No measurable sends yet.'}
      </p>
    )
  }

  const verdictTone =
    board.verdict.status === 'winner'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : board.verdict.status === 'no_difference'
        ? 'border-white/15 bg-white/5 text-white/60'
        : 'border-amber-400/25 bg-amber-400/10 text-amber-200'

  const fmtDate = (v: number | null) =>
    v ? new Date(v).toLocaleDateString(isEs ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' }) : '—'

  // Arms that started more than two weeks apart are not comparable all-time.
  const firsts = board.arms.filter((a) => a.delivered > 0 && a.first_sent_ms).map((a) => a.first_sent_ms as number)
  const spreadDays = firsts.length > 1 ? (Math.max(...firsts) - Math.min(...firsts)) / 86400000 : 0
  const skewed = spreadDays > 14 && !aligned

  return (
    <section className="mb-10 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            {isEs ? 'Prueba A/B: primer correo' : 'A/B scoreboard: first-touch email'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            {isEs
              ? 'Qué correo de apertura genera más reclamos. Cada variante se compara con un control equivalente, y solo se declara un ganador con volumen suficiente.'
              : 'Which opening email actually produces claims. Each arm is compared against a matched control cohort, and a winner is only declared with enough volume to mean it.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {board.aligned_since_ms && spreadDays > 14 && (
            <button
              onClick={() => {
                const next = !aligned
                setAligned(next)
                load(next ? board.aligned_since_ms : null)
              }}
              className={`rounded border px-3 py-1.5 text-xs font-bold transition ${
                aligned ? 'border-brand-neon/50 bg-brand-neon/10 text-brand-neon' : 'border-white/20 text-white/60 hover:bg-white/10'
              }`}
            >
              {aligned
                ? isEs ? 'Ventana alineada' : 'Aligned window'
                : isEs ? 'Alinear ventana' : 'Align window'}
            </button>
          )}
          <div className="text-right">
            <p className="text-2xl font-black text-white">{board.totals.delivered.toLocaleString()}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
              {isEs ? 'Medidos' : 'Measured'}
            </p>
          </div>
        </div>
      </div>

      <div className={`mb-3 rounded-lg border px-4 py-3 text-sm ${verdictTone}`}>
        {isEs ? board.verdict.message_es : board.verdict.message}
      </div>

      {skewed && (
        <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2 text-xs text-amber-200/90">
          {isEs
            ? `Las variantes empezaron con ${Math.round(spreadDays)} días de diferencia — la vista histórica compara periodos y cohortes distintos. Usa "Alinear ventana".`
            : `Arms started ${Math.round(spreadDays)} days apart — the all-time view compares different periods and listing cohorts. Use "Align window".`}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
              <th className="px-4 py-2">{isEs ? 'Variante' : 'Arm'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Medidos' : 'Measured'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Aperturas' : 'Opens'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Clics' : 'Clicks'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Reclamos' : 'Claims'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Rango real' : 'True range'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Bajas' : 'Unsub'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'vs control' : 'vs control'}</th>
              <th className="px-4 py-2">{isEs ? 'Activa' : 'Active'}</th>
            </tr>
          </thead>
          <tbody>
            {board.arms.map((a) => {
              const isWinner = board.verdict.winner === a.key
              const sig = a.powered && a.comparable && a.p_vs_control !== null && a.p_vs_control < board.alpha
              return (
                <tr
                  key={a.key}
                  className={`border-b border-white/5 last:border-0 ${isWinner ? 'bg-emerald-400/[0.06]' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-white/85">
                      {isEs ? a.label_es : a.label}
                      {a.key === 0 && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/50">
                          control
                        </span>
                      )}
                      {isWinner && (
                        <span className="ml-2 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                          {isEs ? 'gana' : 'winner'}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 max-w-sm text-[11px] leading-4 text-white/35">{isEs ? a.note_es : a.note}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">
                    {a.delivered.toLocaleString()}
                    {a.in_flight > 0 && (
                      <p className="text-[10px] font-normal text-white/30">
                        +{a.in_flight} {isEs ? 'en curso' : 'in flight'}
                      </p>
                    )}
                    {!a.powered && a.delivered > 0 && Number.isFinite(a.required_n) && (
                      <p className="text-[10px] font-normal text-amber-300/70">
                        {isEs
                          ? `faltan ${Math.max(0, Math.round(a.required_n) - a.delivered).toLocaleString()} para poder leerla`
                          : `${Math.max(0, Math.round(a.required_n) - a.delivered).toLocaleString()} more before it can be read`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/70">
                    {pct(a.open_rate)}
                    <span className="ml-1 text-[10px] text-white/30">({a.opened})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-white/70">
                    {pct(a.click_rate)}
                    <span className="ml-1 text-[10px] text-white/30">({a.clicked})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">
                    {pct(a.conversion_rate)}
                    <span className="ml-1 text-[10px] font-normal text-white/30">({a.converted})</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-[11px] text-white/40">
                    {a.delivered > 0 ? `${pct(a.conversion_ci[0])}–${pct(a.conversion_ci[1])}` : '—'}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right text-xs ${
                      a.unsub_rate > 0.02 ? 'font-bold text-amber-300' : 'text-white/45'
                    }`}
                  >
                    {a.delivered > 0 ? pct(a.unsub_rate) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs">
                    {a.key === 0 ? (
                      <span className="text-white/25">—</span>
                    ) : !a.comparable ? (
                      <span className="text-white/25">{isEs ? 'sin control comparable' : 'no matched control'}</span>
                    ) : !a.powered ? (
                      <span className="text-white/25">{isEs ? 'muy pocos envíos' : 'too few sends'}</span>
                    ) : a.p_vs_control === null ? (
                      <span className="text-white/25">{isEs ? 'muy pocos reclamos' : 'too few claims'}</span>
                    ) : (
                      <>
                        {/* Colour by the DIRECTION of the difference, never by the
                            truthiness of lift — lift is null when the matched
                            control has no conversions, which would paint a
                            significantly better arm red. */}
                        <span
                          className={
                            sig
                              ? a.better_than_control
                                ? 'font-bold text-emerald-300'
                                : 'font-bold text-red-300'
                              : 'text-white/45'
                          }
                        >
                          {a.lift_vs_control !== null
                            ? `${a.lift_vs_control >= 1 ? '+' : ''}${Math.round((a.lift_vs_control - 1) * 100)}%`
                            : a.better_than_control
                              ? isEs ? 'mejor' : 'better'
                              : isEs ? 'igual' : 'even'}
                        </span>
                        <p className="text-[10px] text-white/30">p={fmtP(a.p_vs_control)}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-white/35">
                    {a.first_sent_ms ? `${fmtDate(a.first_sent_ms)} → ${fmtDate(a.last_sent_ms)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-white/30">
        {isEs
          ? `Un reclamo se atribuye a la variante que abrió la secuencia de 3 correos, no solo al asunto. Los envíos de menos de 14 días siguen "en curso". Umbral corregido p<${board.alpha.toFixed(4)}.`
          : `A claim is credited to the arm that opened the 3-email sequence, not to the subject line alone. Sends under 14 days old are still "in flight". Corrected threshold p<${board.alpha.toFixed(4)}.`}
        {board.excluded_downgraded > 0 &&
          (isEs
            ? ` ${board.excluded_downgraded.toLocaleString()} envíos excluidos: su variante se degradó por falta de datos (no fueron aleatorios).`
            : ` ${board.excluded_downgraded.toLocaleString()} sends excluded: their arm was downgraded for missing data, so they were not randomly assigned.`)}
      </p>
    </section>
  )
}
