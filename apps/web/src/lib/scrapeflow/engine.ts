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
  // Dry runs are previews: they must not advance the schedule (`last_run_at`
  // drives the cron's due check) — only real runs stamp it.
  await wfRef
    .update(
      opts.dryRun
        ? { last_run_id: runRef.id, last_run_status: 'RUNNING' }
        : { last_run_at: startedAt, last_run_id: runRef.id, last_run_status: 'RUNNING' }
    )
    .catch(() => {})

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

/**
 * Slack on the "has its interval elapsed?" test. Generous on purpose: the cost
 * of running a workflow slightly early is one extra fetch, and the cost of
 * running it slightly late is losing an entire day of a daily source.
 */
export const DUE_TOLERANCE_MS = 60 * 60 * 1000

/**
 * How many of its own intervals a workflow is overdue by. 1.0 means "due now",
 * 2.0 means "a full cycle has already been missed", Infinity means "never run".
 *
 * This is the ordering key for the nightly queue, and the reason is worth
 * stating. Sorting by `last_run_at` ascending — oldest first — sounds fair and
 * is not: it ranks a WEEKLY workflow that has only just come due above a DAILY
 * one that has already missed a cycle, because the weekly one's timestamp is
 * older by construction. That is how comptroller-el-paso-new-permits, the only
 * source that supplies genuinely new El Paso businesses each weekday, came
 * fourth behind a weekly dentist roster and was cut by the three-slot limit.
 *
 * Measuring lateness against each workflow's own interval makes the comparison
 * meaningful, and it self-balances: daily sources sit near 1.0 and win while
 * they are behind, and a weekly source that slips to 1.3 outranks them again.
 */
export function overdueRatio(
  workflow: { last_run_at?: string | null; interval_hours: number },
  now: number
): number {
  if (!workflow.last_run_at) return Infinity
  const last = Date.parse(workflow.last_run_at)
  if (Number.isNaN(last)) return Infinity
  return (now - last) / Math.max(1, workflow.interval_hours * 3_600_000)
}

/** Cron entry: run enabled workflows whose interval has elapsed, most overdue first. */
export async function runDueWorkflows(opts: { limit?: number; dryRun?: boolean; totalBudgetMs?: number } = {}) {
  const limit = Math.max(1, opts.limit || 3)
  const deadline = Date.now() + (opts.totalBudgetMs || 270_000)
  const now = Date.now()
  const eligible = (await listWorkflows())
    .filter((w) => w.enabled && w.definition.nodes.length > 0)
    // DUE_TOLERANCE_MS, not 60s. last_run_at is stamped at the run's START, so a
    // workflow that began 13 seconds into yesterday's batch was 13 seconds short
    // of its 24h interval today and was filtered out for a WHOLE DAY. That is
    // exactly what happened to comptroller-el-paso-new-permits: it ran
    // 2026-10-25T08:31:13, needed 86,340s by 2026-10-26T08:30:00 and had 86,327.
    // A daily cron's own jitter must never cost a day's work.
    .filter((w) => !w.last_run_at || now - Date.parse(w.last_run_at) >= w.interval_hours * 3_600_000 - DUE_TOLERANCE_MS)
    .filter((w) => w.last_run_status !== 'RUNNING' || !w.last_run_at || now - Date.parse(w.last_run_at) > 3_600_000)
  // Most overdue RELATIVE TO ITS OWN INTERVAL first, not simply oldest. Sorting
  // by last_run_at put a weekly workflow that had only just come due ahead of a
  // daily one that had already missed a cycle — which is how the Comptroller
  // feed, the only source that supplies genuinely new businesses each weekday,
  // came 4th behind a weekly dentist roster and got cut by the limit.
  const due = [...eligible].sort((a, b) => overdueRatio(b, now) - overdueRatio(a, now)).slice(0, limit)
  // Eight enabled workflows share `limit` slots once a day. The route reported
  // {due, ran} and never said due > ran, so a starved queue was invisible and
  // every run still reported COMPLETED.
  const starved = eligible.length - due.length

  const results: Array<{ workflow_id: string; name: string; run_id: string; status: WorkflowRunStatus; inserted: number; error: string | null }> = []
  for (const wf of due) {
    const remaining = deadline - Date.now()
    if (remaining < 30_000) break
    const run = await runWorkflow(wf, { trigger: 'cron', dryRun: opts.dryRun, timeBudgetMs: Math.min(DEFAULT_TIME_BUDGET_MS, remaining - 10_000) })
    results.push({ workflow_id: wf.id, name: wf.name, run_id: run.id, status: run.status, inserted: run.summary.inserted, error: run.error })
  }
  // `starved` is the number of workflows that were due and did not get a slot.
  // It is the only way an operator can see the queue is over-subscribed: before
  // this the response said due:3 ran:3 on a night when 5 sources were waiting.
  return { due: due.length, ran: results, eligible: eligible.length, starved }
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
