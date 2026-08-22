// Workflow runner + Firestore persistence. Port of ScrapeFlow's
// `execute-workflow.ts` (phase loop → per-phase env → executor → logs →
// finalize) with Firestore (`scrapeflow_workflows`, `scrapeflow_runs`) standing
// in for Prisma's Workflow / WorkflowExecution / ExecutionPhase / ExecutionLog.

import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { closeSession, ExecutorRegistry, type ExecutionEnvironment } from './executors'
import type { PageSession } from './browser'
import { getTask } from './tasks'
import { resolveInputs, validateDefinition } from './definition'
import { WORKFLOW_TEMPLATES } from './templates'
import {
  TaskType,
  type LogEntry,
  type LogLevel,
  type PhaseResult,
  type RunSummary,
  type WorkflowDefinition,
  type WorkflowDoc,
  type WorkflowRunDoc,
  type WorkflowRunResult,
  type WorkflowRunStatus,
} from './types'

export const WORKFLOWS_COLLECTION = 'scrapeflow_workflows'
export const RUNS_COLLECTION = 'scrapeflow_runs'

const OUTPUT_STORE_LIMIT = 4000 // chars per stored input/output value (keeps run docs well under 1MB)
const DEFAULT_TIME_BUDGET_MS = 240_000 // under the 300s route maxDuration

export { validateDefinition, resolveInputs } from './definition'

function truncate(v: string, n = OUTPUT_STORE_LIMIT): string {
  return v.length > n ? `${v.slice(0, n)}… [+${v.length - n} chars]` : v
}

// ---------- runner ----------

export interface ExecuteOptions {
  workflowId?: string | null
  runIndex?: number
  dryRun?: boolean
  timeBudgetMs?: number
  onPhase?: (phase: PhaseResult) => void | Promise<void>
}

export async function executeWorkflow(definition: WorkflowDefinition, opts: ExecuteOptions = {}): Promise<WorkflowRunResult> {
  const startedAt = new Date()
  const phases: PhaseResult[] = []
  const outputsByNode: Record<string, Record<string, string>> = {}
  const order: string[] = []
  const summary: RunSummary = { candidates: 0, inserted: 0, skipped_existing: 0, skipped_invalid: 0, pages_crawled: 0 }
  let session: PageSession | null = null
  let credits = 0
  let failed = false
  let error: string | null = null
  const ctx: ExecutionEnvironment['ctx'] = {
    workflowId: opts.workflowId || null,
    runIndex: opts.runIndex || 0,
    dryRun: Boolean(opts.dryRun),
    summary,
    deadline: Date.now() + (opts.timeBudgetMs || DEFAULT_TIME_BUDGET_MS),
  }

  try {
    for (const [i, node] of definition.nodes.entries()) {
      const task = getTask(node.type)!
      const logs: LogEntry[] = []
      const write = (level: LogLevel, message: string) => logs.push({ level, message: String(message).slice(0, 2000), ts: new Date().toISOString() })
      const inputs = resolveInputs(node, outputsByNode, order)
      const outputs: Record<string, string> = {}
      const phase: PhaseResult = {
        node_id: node.id,
        type: node.type,
        label: task.label,
        number: i + 1,
        status: 'RUNNING',
        started_at: new Date().toISOString(),
        completed_at: null,
        credits: task.credits,
        inputs: {},
        outputs: {},
        logs,
      }
      if (Date.now() > ctx.deadline) {
        write('error', 'Time budget exhausted before this phase started')
        phase.status = 'FAILED'
        phase.completed_at = new Date().toISOString()
        phases.push(phase)
        failed = true
        error = `Time budget exhausted at phase ${i + 1}`
        break
      }
      const env: ExecutionEnvironment = {
        getInput: (name) => inputs[name] ?? '',
        setOutput: (name, value) => {
          outputs[name] = value
        },
        getSession: () => session,
        setSession: (s) => {
          session = s
        },
        log: { info: (m) => write('info', m), warn: (m) => write('warn', m), error: (m) => write('error', m), write },
        ctx,
      }
      let ok = false
      try {
        ok = await ExecutorRegistry[node.type as TaskType](env)
      } catch (e: any) {
        write('error', `Unhandled executor error: ${e?.message || e}`)
        ok = false
      }
      outputsByNode[node.id] = outputs
      order.push(node.id)
      credits += task.credits
      phase.status = ok ? 'COMPLETED' : 'FAILED'
      phase.completed_at = new Date().toISOString()
      phase.inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, truncate(v)]))
      phase.outputs = Object.fromEntries(Object.entries(outputs).map(([k, v]) => [k, truncate(v)]))
      phases.push(phase)
      if (opts.onPhase) await opts.onPhase(phase)
      if (!ok) {
        failed = true
        error = `Phase ${i + 1} (${task.label}) failed: ${logs.filter((l) => l.level === 'error').map((l) => l.message).join('; ') || 'see logs'}`
        break
      }
    }
  } finally {
    await closeSession(session)
  }

  return {
    status: failed ? 'FAILED' : 'COMPLETED',
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    credits_consumed: credits,
    phases,
    summary,
    error,
  }
}

// ---------- persistence ----------

function docToWorkflow(id: string, d: any): WorkflowDoc {
  return {
    id,
    name: String(d.name || 'Untitled workflow'),
    description: d.description ?? null,
    definition: d.definition && Array.isArray(d.definition.nodes) ? d.definition : { nodes: [] },
    enabled: Boolean(d.enabled),
    interval_hours: Number(d.interval_hours) || 24,
    run_count: Number(d.run_count) || 0,
    last_run_at: d.last_run_at ?? null,
    last_run_status: d.last_run_status ?? null,
    last_run_id: d.last_run_id ?? null,
    total_inserted: Number(d.total_inserted) || 0,
    created_at: d.created_at ?? null,
    updated_at: d.updated_at ?? null,
  }
}

export async function listWorkflows(): Promise<WorkflowDoc[]> {
  const snap = await adminDb.collection(WORKFLOWS_COLLECTION).get()
  return snap.docs.map((d) => docToWorkflow(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getWorkflow(id: string): Promise<WorkflowDoc | null> {
  const snap = await adminDb.collection(WORKFLOWS_COLLECTION).doc(id).get()
  return snap.exists ? docToWorkflow(snap.id, snap.data()) : null
}

export async function createWorkflow(input: {
  name: string
  description?: string | null
  definition: WorkflowDefinition
  enabled?: boolean
  interval_hours?: number
  template_key?: string | null
}): Promise<WorkflowDoc> {
  const now = new Date().toISOString()
  const ref = await adminDb.collection(WORKFLOWS_COLLECTION).add({
    name: input.name.trim().slice(0, 120) || 'Untitled workflow',
    description: input.description?.trim().slice(0, 500) || null,
    definition: input.definition,
    enabled: input.enabled ?? false,
    interval_hours: Math.max(1, Number(input.interval_hours) || 24),
    template_key: input.template_key || null,
    run_count: 0,
    last_run_at: null,
    last_run_status: null,
    last_run_id: null,
    total_inserted: 0,
    created_at: now,
    updated_at: now,
  })
  return (await getWorkflow(ref.id))!
}

export async function updateWorkflow(
  id: string,
  patch: Partial<Pick<WorkflowDoc, 'name' | 'description' | 'definition' | 'enabled' | 'interval_hours'>>
): Promise<WorkflowDoc | null> {
  const data: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) data.name = String(patch.name).trim().slice(0, 120) || 'Untitled workflow'
  if (patch.description !== undefined) data.description = patch.description ? String(patch.description).trim().slice(0, 500) : null
  if (patch.definition !== undefined) data.definition = patch.definition
  if (patch.enabled !== undefined) data.enabled = Boolean(patch.enabled)
  if (patch.interval_hours !== undefined) data.interval_hours = Math.max(1, Number(patch.interval_hours) || 24)
  const ref = adminDb.collection(WORKFLOWS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return null
  await ref.update(data)
  return getWorkflow(id)
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const ref = adminDb.collection(WORKFLOWS_COLLECTION).doc(id)
  const snap = await ref.get()
  if (!snap.exists) return false
  await ref.delete()
  return true
}

export async function listRuns(workflowId: string, limit = 10): Promise<WorkflowRunDoc[]> {
  // No composite index needed: filter on one field, sort in memory.
  const snap = await adminDb.collection(RUNS_COLLECTION).where('workflow_id', '==', workflowId).limit(200).get()
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as WorkflowRunDoc)
    .sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
    .slice(0, limit)
}

export async function getRun(id: string): Promise<WorkflowRunDoc | null> {
  const snap = await adminDb.collection(RUNS_COLLECTION).doc(id).get()
  return snap.exists ? ({ id: snap.id, ...(snap.data() as any) } as WorkflowRunDoc) : null
}

/** Execute a stored workflow and persist the run (ScrapeFlow's execution record). */
export async function runWorkflow(
  workflow: WorkflowDoc,
  opts: { trigger: 'manual' | 'cron'; dryRun?: boolean; timeBudgetMs?: number }
): Promise<WorkflowRunDoc> {
  const valid = validateDefinition(workflow.definition)
  if (!valid.ok) throw new Error(`Invalid workflow definition: ${valid.error}`)

  const runRef = adminDb.collection(RUNS_COLLECTION).doc()
  const startedAt = new Date().toISOString()
  const base = {
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    trigger: opts.trigger,
    dry_run: Boolean(opts.dryRun),
    definition: valid.definition,
    status: 'RUNNING' as WorkflowRunStatus,
    started_at: startedAt,
    completed_at: null as string | null,
    credits_consumed: 0,
    phases: [] as PhaseResult[],
    summary: { candidates: 0, inserted: 0, skipped_existing: 0, skipped_invalid: 0, pages_crawled: 0 },
    error: null as string | null,
  }
  await runRef.set(base)
  const wfRef = adminDb.collection(WORKFLOWS_COLLECTION).doc(workflow.id)
  await wfRef.update({ last_run_at: startedAt, last_run_id: runRef.id, last_run_status: 'RUNNING' }).catch(() => {})

  let result: WorkflowRunResult
  try {
    result = await executeWorkflow(valid.definition, {
      workflowId: workflow.id,
      runIndex: workflow.run_count,
      dryRun: opts.dryRun,
      timeBudgetMs: opts.timeBudgetMs,
      onPhase: async (phase) => {
        // Stream progress so the admin page can watch a long run.
        await runRef.update({ phases: FieldValue.arrayUnion(phase) }).catch(() => {})
      },
    })
  } catch (e: any) {
    result = {
      status: 'FAILED',
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      credits_consumed: 0,
      phases: [],
      summary: base.summary,
      error: e?.message || String(e),
    }
  }

  const finished = { ...base, ...result }
  await runRef.set(finished)
  const inc = opts.dryRun ? 0 : result.summary.inserted
  await wfRef
    .update({
      last_run_status: result.status,
      run_count: (workflow.run_count || 0) + (opts.dryRun ? 0 : 1),
      total_inserted: (workflow.total_inserted || 0) + inc,
      updated_at: new Date().toISOString(),
    })
    .catch(() => {})
  return { id: runRef.id, ...finished }
}

/** Cron entry: run enabled workflows whose interval has elapsed, oldest first. */
export async function runDueWorkflows(opts: { limit?: number; dryRun?: boolean; totalBudgetMs?: number } = {}) {
  const limit = Math.max(1, opts.limit || 3)
  const deadline = Date.now() + (opts.totalBudgetMs || 270_000)
  const now = Date.now()
  const due = (await listWorkflows())
    .filter((w) => w.enabled && w.definition.nodes.length > 0)
    .filter((w) => !w.last_run_at || now - Date.parse(w.last_run_at) >= w.interval_hours * 3_600_000 - 60_000)
    .filter((w) => w.last_run_status !== 'RUNNING' || !w.last_run_at || now - Date.parse(w.last_run_at) > 3_600_000)
    .sort((a, b) => (a.last_run_at || '').localeCompare(b.last_run_at || ''))
    .slice(0, limit)

  const results: Array<{ workflow_id: string; name: string; run_id: string; status: WorkflowRunStatus; inserted: number; error: string | null }> = []
  for (const wf of due) {
    const remaining = deadline - Date.now()
    if (remaining < 30_000) break
    const run = await runWorkflow(wf, { trigger: 'cron', dryRun: opts.dryRun, timeBudgetMs: Math.min(DEFAULT_TIME_BUDGET_MS, remaining - 10_000) })
    results.push({ workflow_id: wf.id, name: wf.name, run_id: run.id, status: run.status, inserted: run.summary.inserted, error: run.error })
  }
  return { due: due.length, ran: results }
}

/** Seed the bundled templates once (idempotent by template_key). */
export async function ensureSeeded(): Promise<number> {
  const snap = await adminDb.collection(WORKFLOWS_COLLECTION).get()
  const existingKeys = new Set(snap.docs.map((d) => (d.data() as any).template_key).filter(Boolean))
  let created = 0
  for (const tpl of WORKFLOW_TEMPLATES) {
    if (existingKeys.has(tpl.key)) continue
    await createWorkflow({
      name: tpl.name,
      description: tpl.description,
      definition: tpl.definition,
      enabled: tpl.enabled,
      interval_hours: tpl.interval_hours,
      template_key: tpl.key,
    })
    created++
  }
  return created
}
