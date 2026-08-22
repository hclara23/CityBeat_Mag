// Pure definition helpers (no Firestore / network imports) so they can be
// unit-tested and reused by the API validation layer.

import { getTask } from './tasks'
import type { WorkflowDefinition, WorkflowNode } from './types'

export function validateDefinition(def: unknown): { ok: true; definition: WorkflowDefinition } | { ok: false; error: string } {
  if (!def || typeof def !== 'object') return { ok: false, error: 'Definition must be an object' }
  const nodes = (def as any).nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return { ok: false, error: 'Definition needs a non-empty "nodes" array' }
  const ids = new Set<string>()
  const clean: WorkflowNode[] = []
  for (const [i, raw] of nodes.entries()) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: `Node ${i + 1} is not an object` }
    const id = String(raw.id || `n${i + 1}`).trim()
    if (ids.has(id)) return { ok: false, error: `Duplicate node id "${id}"` }
    ids.add(id)
    const task = getTask(String(raw.type || ''))
    if (!task) return { ok: false, error: `Node "${id}": unknown task type "${raw.type}"` }
    if (i === 0 && !task.isEntryPoint) return { ok: false, error: `First node must be LAUNCH_BROWSER (got ${task.type})` }
    if (i > 0 && task.isEntryPoint) return { ok: false, error: `Node "${id}": LAUNCH_BROWSER must be the first node` }
    const inputs: Record<string, string> = {}
    const rawInputs = raw.inputs && typeof raw.inputs === 'object' ? raw.inputs : {}
    for (const [k, v] of Object.entries(rawInputs)) {
      if (v === null || v === undefined) continue
      inputs[k] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    for (const param of task.inputs) {
      if (param.required && param.type !== 'BROWSER_INSTANCE' && !inputs[param.name]) {
        // Can be satisfied at runtime by an earlier node's same-named output — only
        // fail validation when NO earlier node can produce it.
        const producible = clean.some((n) => getTask(n.type)!.outputs.some((o) => o.name === param.name))
        if (!producible) return { ok: false, error: `Node "${id}" (${task.label}): missing required input "${param.name}"` }
      }
    }
    clean.push({ id, type: task.type, inputs })
  }
  return { ok: true, definition: { nodes: clean } }
}

const REF_RE = /\{\{\s*([^}.]+?)\s*\.\s*([^}]+?)\s*\}\}/g

/** Resolve `{{nodeId.Output}}` references and implicit same-name wiring. */
export function resolveInputs(
  node: WorkflowNode,
  outputsByNode: Record<string, Record<string, string>>,
  order: string[]
): Record<string, string> {
  const task = getTask(node.type)!
  const resolved: Record<string, string> = {}
  const latest = (name: string): string | undefined => {
    for (let i = order.length - 1; i >= 0; i--) {
      const v = outputsByNode[order[i]]?.[name]
      if (v !== undefined) return v
    }
    return undefined
  }
  for (const [k, v] of Object.entries(node.inputs)) {
    resolved[k] = v.replace(REF_RE, (_m, nid: string, out: string) => {
      const val = outputsByNode[nid.trim()]?.[out.trim()]
      return val === undefined ? '' : val
    })
  }
  for (const param of task.inputs) {
    if (resolved[param.name] === undefined || resolved[param.name] === '') {
      const implicit = latest(param.name)
      if (implicit !== undefined) resolved[param.name] = implicit
      else if (param.defaultValue !== undefined && resolved[param.name] === undefined) resolved[param.name] = param.defaultValue
    }
  }
  return resolved
}

/** Find the first JSON value in a model reply, tolerating prose/fences around it. */
export function parseJsonLoose(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    /* fall through */
  }
  const starts = ['[', '{'].map((c) => cleaned.indexOf(c)).filter((i) => i >= 0)
  if (!starts.length) throw new Error('No JSON in model response')
  const start = Math.min(...starts)
  const closer = cleaned[start] === '[' ? ']' : '}'
  const end = cleaned.lastIndexOf(closer)
  if (end <= start) throw new Error('Unterminated JSON in model response')
  return JSON.parse(cleaned.slice(start, end + 1))
}
