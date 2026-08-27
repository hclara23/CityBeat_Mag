'use client'

// /admin/scrapeflow — godmode UI for the ScrapeFlow engine (lib/scrapeflow):
// list workflows, toggle/schedule them, run (dry or live), inspect phase logs,
// and edit the JSON definition. Replaces ScrapeFlow's React-Flow canvas with a
// compact JSON editor + node reference.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'

type TaskParam = { name: string; type: string; helperText?: string; required?: boolean; options?: string[]; defaultValue?: string }
type Task = { type: string; label: string; description: string; credits: number; inputs: TaskParam[]; outputs: TaskParam[] }
type Workflow = {
  id: string
  name: string
  description: string | null
  definition: { nodes: Array<{ id: string; type: string; inputs: Record<string, string> }> }
  enabled: boolean
  interval_hours: number
  run_count: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_id: string | null
  total_inserted: number
}
type Phase = {
  node_id: string
  type: string
  label: string
  number: number
  status: string
  started_at: string | null
  completed_at: string | null
  inputs: Record<string, string>
  outputs: Record<string, string>
  logs: Array<{ level: string; message: string; ts: string }>
}
type Run = {
  id: string
  status: string
  trigger: string
  dry_run: boolean
  started_at: string
  completed_at: string | null
  credits_consumed: number
  phases: Phase[]
  summary: { candidates: number; inserted: number; skipped_existing: number; skipped_invalid: number; pages_crawled: number }
  error: string | null
}
type Capabilities = { ai: boolean; crawl4ai: boolean; puppeteer: boolean }

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—')
const statusColor = (s: string | null | undefined) =>
  s === 'COMPLETED' ? 'text-emerald-300' : s === 'FAILED' ? 'text-red-300' : s === 'RUNNING' ? 'text-amber-300' : 'text-white/50'

export default function AdminScrapeFlowPage() {
  const locale = useLocale()
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [tasks, setTasks] = useState<Record<string, Task>>({})
  const [templates, setTemplates] = useState<Array<{ key: string; name: string; description: string }>>([])
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [openRun, setOpenRun] = useState<Run | null>(null)
  const [editor, setEditor] = useState('')
  const [editorName, setEditorName] = useState('')
  const [editorDesc, setEditorDesc] = useState('')
  const [editorInterval, setEditorInterval] = useState(24)
  const [busy, setBusy] = useState<string>('')
  const [notice, setNotice] = useState('')
  const [showRef, setShowRef] = useState(false)

  const selected = useMemo(() => workflows.find((w) => w.id === selectedId) || null, [workflows, selectedId])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/scrapeflow', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        setError('Godmode (developer) access required for ScrapeFlow.')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setWorkflows(data.workflows || [])
      setTasks(data.tasks || {})
      setTemplates(data.templates || [])
      setCaps(data.capabilities || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/scrapeflow/${id}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRuns(data.runs || [])
    setWorkflows((prev) => prev.map((w) => (w.id === id ? data.workflow : w)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    setEditor(JSON.stringify(selected.definition, null, 2))
    setEditorName(selected.name)
    setEditorDesc(selected.description || '')
    setEditorInterval(selected.interval_hours)
    setOpenRun(null)
    loadDetail(selected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 6000)
  }

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/scrapeflow/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Update failed')
    setWorkflows((prev) => prev.map((w) => (w.id === id ? data.workflow : w)))
    return data.workflow as Workflow
  }

  const toggle = async (w: Workflow) => {
    try {
      await patch(w.id, { enabled: !w.enabled })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const saveEditor = async () => {
    if (!selected) return
    let definition: unknown
    try {
      definition = JSON.parse(editor)
    } catch {
      alert('Definition is not valid JSON')
      return
    }
    setBusy('save')
    try {
      await patch(selected.id, { definition, name: editorName, description: editorDesc, interval_hours: editorInterval })
      flash('Saved.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy('')
    }
  }

  const runNow = async (w: Workflow, dryRun: boolean) => {
    if (!dryRun && !confirm(`Run "${w.name}" LIVE? New businesses will be inserted into the directory.`)) return
    setBusy(dryRun ? 'dry' : 'live')
    try {
      const res = await fetch(`/api/admin/scrapeflow/${w.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Run failed')
      setOpenRun(data.run)
      await loadDetail(w.id)
      const s = data.run?.summary || {}
      flash(
        data.run?.status === 'COMPLETED'
          ? `${dryRun ? 'Dry run' : 'Run'} finished: ${s.pages_crawled} pages, ${s.candidates} candidates, ${dryRun ? 'would insert ' + (data.run.phases?.at(-1)?.outputs?.Result ? JSON.parse(data.run.phases.at(-1).outputs.Result).would_insert ?? '?' : '?') : s.inserted + ' inserted'}.`
          : `Run failed: ${data.run?.error || 'see logs'}`
      )
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setBusy('')
    }
  }

  const createFromTemplate = async (key: string) => {
    setBusy('create')
    try {
      const res = await fetch('/api/admin/scrapeflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: key }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Create failed')
      await load()
      setSelectedId(data.workflow.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy('')
    }
  }

  const consolidateAll = async () => {
    setBusy('consolidate')
    try {
      const plan = await fetch('/api/admin/directory/consolidate', { cache: 'no-store' }).then((r) => r.json())
      if (!plan || plan.error) throw new Error(plan?.error || 'Plan failed')
      if (!plan.groups_merged) {
        flash('Nothing to consolidate — no same-brand duplicates found.')
        return
      }
      const preview = (plan.plan || []).slice(0, 8).map((p: any) => `• ${p.brand} (${p.locations} locations)`).join('\n')
      if (!confirm(`Merge ${plan.groups_merged} brand group(s) into multi-location cards and fold ${plan.siblings_unpublished} duplicate card(s)?\n\n${preview}${plan.plan.length > 8 ? '\n…' : ''}`)) return
      const res = await fetch('/api/admin/directory/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Consolidation failed')
      flash(`Consolidated ${data.groups_merged} brand group(s); ${data.siblings_unpublished} duplicate card(s) folded in (reversible via merged_into).`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Consolidation failed')
    } finally {
      setBusy('')
    }
  }

  const remove = async (w: Workflow) => {
    if (!confirm(`Delete workflow "${w.name}"? Runs history stays; listings already inserted are untouched.`)) return
    await fetch(`/api/admin/scrapeflow/${w.id}`, { method: 'DELETE' })
    if (selectedId === w.id) setSelectedId(null)
    await load()
  }

  return (
    <div className="min-h-screen bg-brand-ink text-white">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-neon">Godmode · Directory growth</p>
            <h1 className="text-3xl font-black">ScrapeFlow</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/60">
              Visual-workflow scraper (ported from the open-source ScrapeFlow engine) that pulls businesses from public
              directories into the CityBeat directory. Insert-only: paying/claimed listings are never touched. Runs nightly via{' '}
              <code className="rounded bg-white/10 px-1">citybeat-scrapeflow</code> (Cloud Scheduler) or on demand here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              disabled={busy === 'consolidate'}
              onClick={consolidateAll}
              className="rounded-md border border-brand-neon/50 px-3 py-2 font-bold uppercase tracking-wider text-brand-neon hover:bg-brand-neon/10 disabled:opacity-50"
              title="Merge same-brand listings (multiple locations) into one card with locations[]"
            >
              {busy === 'consolidate' ? 'Consolidating…' : 'Consolidate multi-location'}
            </button>
            <Link href={withLocale(locale, '/admin/directory')} className="rounded-md border border-white/15 px-3 py-2 font-bold uppercase tracking-wider text-white/70 hover:text-brand-neon">
              Directory Manager
            </Link>
            <Link href={withLocale(locale, '/admin')} className="rounded-md border border-white/15 px-3 py-2 font-bold uppercase tracking-wider text-white/70 hover:text-brand-neon">
              Admin Hub
            </Link>
          </div>
        </div>

        {caps && (
          <div className="mb-6 flex flex-wrap gap-3 text-xs">
            <Cap ok={caps.ai} label="Claude extraction (ANTHROPIC_API_KEY)" />
            <Cap ok={caps.crawl4ai} label="Crawl4AI browser backend (CRAWLER_URL)" />
            <Cap ok={caps.puppeteer} label="Puppeteer (local only)" />
            <span className="rounded-full border border-white/15 px-3 py-1 text-white/60">
              fetch backend: always on
            </span>
          </div>
        )}

        {notice && <div className="mb-4 rounded-md border border-brand-neon/40 bg-brand-neon/10 px-4 py-2 text-sm">{notice}</div>}
        {error && <div className="mb-4 rounded-md border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          {/* Workflow list */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Workflows</h2>
              <details className="relative">
                <summary className="cursor-pointer rounded-md bg-brand-neon px-3 py-1.5 text-xs font-black uppercase tracking-wider text-brand-ink">
                  + New from template
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-white/10 bg-brand-ink p-2 shadow-xl">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      disabled={busy === 'create'}
                      onClick={() => createFromTemplate(t.key)}
                      className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-white/10"
                    >
                      <span className="font-bold">{t.name}</span>
                      <span className="mt-0.5 block text-white/50">{t.description.slice(0, 110)}…</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
            {loading ? (
              <p className="text-sm text-white/50">Loading…</p>
            ) : workflows.length === 0 ? (
              <p className="text-sm text-white/50">No workflows yet.</p>
            ) : (
              <ul className="space-y-2">
                {workflows.map((w) => (
                  <li
                    key={w.id}
                    className={`rounded-lg border p-3 transition ${selectedId === w.id ? 'border-brand-neon/60 bg-brand-neon/5' : 'border-white/10 bg-black/20 hover:border-white/25'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => setSelectedId(w.id)} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-bold">{w.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{w.description}</p>
                        <p className="mt-1 text-[11px] text-white/45">
                          {w.definition.nodes.length} nodes · every {w.interval_hours}h · {w.run_count} runs · {w.total_inserted} inserted · last:{' '}
                          <span className={statusColor(w.last_run_status)}>{w.last_run_status || 'never'}</span> {w.last_run_at ? `(${fmt(w.last_run_at)})` : ''}
                        </p>
                      </button>
                      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
                        <input type="checkbox" checked={w.enabled} onChange={() => toggle(w)} className="h-4 w-4 accent-[#c6ff00]" />
                        {w.enabled ? 'On' : 'Off'}
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Detail / editor */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            {!selected ? (
              <div className="text-sm text-white/50">
                <p>Select a workflow to run it, read its logs, or edit the definition.</p>
                <button onClick={() => setShowRef((v) => !v)} className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-neon underline">
                  {showRef ? 'Hide' : 'Show'} node reference
                </button>
                {showRef && <NodeReference tasks={tasks} />}
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => runNow(selected, true)}
                    className="rounded-md border border-brand-neon/60 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-brand-neon disabled:opacity-50"
                  >
                    {busy === 'dry' ? 'Running…' : 'Dry run'}
                  </button>
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => runNow(selected, false)}
                    className="rounded-md bg-brand-neon px-3 py-1.5 text-xs font-black uppercase tracking-wider text-brand-ink disabled:opacity-50"
                  >
                    {busy === 'live' ? 'Running…' : 'Run now (live)'}
                  </button>
                  <button disabled={Boolean(busy)} onClick={saveEditor} className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50">
                    {busy === 'save' ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => remove(selected)} className="ml-auto rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-300">
                    Delete
                  </button>
                </div>
                {busy === 'dry' || busy === 'live' ? (
                  <p className="mb-3 text-xs text-amber-300">A run can take a few minutes (pages are fetched politely and Claude reads each one). Keep this tab open.</p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input value={editorName} onChange={(e) => setEditorName(e.target.value)} className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm" placeholder="Name" />
                  <label className="flex items-center gap-2 text-xs text-white/60">
                    every
                    <input
                      type="number"
                      min={1}
                      value={editorInterval}
                      onChange={(e) => setEditorInterval(Number(e.target.value) || 24)}
                      className="w-16 rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm"
                    />
                    h
                  </label>
                </div>
                <textarea value={editorDesc} onChange={(e) => setEditorDesc(e.target.value)} rows={2} className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs" placeholder="Description" />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-white/50">Definition (JSON) — nodes run top to bottom; reference outputs as {'{{nodeId.Output}}'}</p>
                  <button onClick={() => setShowRef((v) => !v)} className="text-[11px] font-bold uppercase tracking-wider text-brand-neon underline">
                    {showRef ? 'Hide' : 'Node reference'}
                  </button>
                </div>
                <textarea
                  value={editor}
                  onChange={(e) => setEditor(e.target.value)}
                  spellCheck={false}
                  rows={16}
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-100"
                />
                {showRef && <NodeReference tasks={tasks} />}

                <h3 className="mt-5 text-sm font-bold uppercase tracking-wider text-white/70">Recent runs</h3>
                {runs.length === 0 ? (
                  <p className="mt-1 text-xs text-white/50">No runs yet — try a Dry run.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {runs.map((r) => (
                      <li key={r.id}>
                        <button
                          onClick={() => setOpenRun(openRun?.id === r.id ? null : r)}
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${openRun?.id === r.id ? 'border-brand-neon/50 bg-brand-neon/5' : 'border-white/10 bg-black/20'}`}
                        >
                          <span>
                            <span className={`font-bold ${statusColor(r.status)}`}>{r.status}</span>{' '}
                            <span className="text-white/50">
                              · {r.trigger}
                              {r.dry_run ? ' · dry' : ''} · {fmt(r.started_at)}
                            </span>
                          </span>
                          <span className="text-white/60">
                            {r.summary?.pages_crawled ?? 0}p · {r.summary?.candidates ?? 0}c · <span className="text-emerald-300">+{r.summary?.inserted ?? 0}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {openRun && <RunDetail run={openRun} />}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function Cap({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 ${ok ? 'border-emerald-400/40 text-emerald-200' : 'border-white/15 text-white/45'}`}>
      {ok ? '●' : '○'} {label}
    </span>
  )
}

function NodeReference({ tasks }: { tasks: Record<string, Task> }) {
  const list = Object.values(tasks)
  if (!list.length) return null
  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-md border border-white/10 bg-black/30 p-3 text-[11px]">
      {list.map((t) => (
        <div key={t.type} className="mb-3">
          <p>
            <code className="rounded bg-white/10 px-1 font-bold text-brand-neon">{t.type}</code> <span className="text-white/80">{t.label}</span>{' '}
            <span className="text-white/45">— {t.description}</span>
          </p>
          {t.inputs.length > 0 && (
            <p className="ml-3 text-white/60">
              in: {t.inputs.map((i) => `${i.name}${i.required ? '*' : ''}${i.defaultValue ? `=${i.defaultValue}` : ''}`).join(' · ')}
            </p>
          )}
          {t.outputs.length > 0 && <p className="ml-3 text-white/60">out: {t.outputs.map((o) => o.name).join(' · ')}</p>}
        </div>
      ))}
    </div>
  )
}

function RunDetail({ run }: { run: Run }) {
  const [openPhase, setOpenPhase] = useState<number | null>(null)
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3 text-xs">
      <p>
        <span className={`font-bold ${statusColor(run.status)}`}>{run.status}</span> · {run.credits_consumed} credits · {fmt(run.started_at)} → {fmt(run.completed_at)}
      </p>
      {run.error && <p className="mt-1 text-red-300">{run.error}</p>}
      <p className="mt-1 text-white/60">
        pages {run.summary?.pages_crawled ?? 0} · candidates {run.summary?.candidates ?? 0} · inserted {run.summary?.inserted ?? 0} · existed {run.summary?.skipped_existing ?? 0} · out of region/invalid{' '}
        {run.summary?.skipped_invalid ?? 0}
      </p>
      <ol className="mt-2 space-y-1">
        {(run.phases || []).map((p) => (
          <li key={p.number}>
            <button onClick={() => setOpenPhase(openPhase === p.number ? null : p.number)} className="flex w-full items-center justify-between rounded border border-white/10 px-2 py-1 text-left">
              <span>
                {p.number}. {p.label} <span className="text-white/40">({p.node_id})</span>
              </span>
              <span className={`font-bold ${statusColor(p.status)}`}>{p.status}</span>
            </button>
            {openPhase === p.number && (
              <div className="ml-3 mt-1 space-y-2 border-l border-white/10 pl-3">
                {p.logs?.length > 0 && (
                  <div>
                    <p className="font-bold uppercase tracking-wider text-white/50">Logs</p>
                    {p.logs.map((l, i) => (
                      <p key={i} className={l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : 'text-white/75'}>
                        <span className="text-white/35">{new Date(l.ts).toLocaleTimeString()}</span> {l.message}
                      </p>
                    ))}
                  </div>
                )}
                {Object.keys(p.outputs || {}).length > 0 && (
                  <div>
                    <p className="font-bold uppercase tracking-wider text-white/50">Outputs</p>
                    {Object.entries(p.outputs).map(([k, v]) => (
                      <details key={k}>
                        <summary className="cursor-pointer text-white/70">
                          {k} <span className="text-white/40">({v.length} chars)</span>
                        </summary>
                        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-2 font-mono text-[10px] text-emerald-100">{v}</pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
