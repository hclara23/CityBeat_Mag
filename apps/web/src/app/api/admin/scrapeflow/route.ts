import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import {
  TaskRegistry,
  WORKFLOW_TEMPLATES,
  createWorkflow,
  ensureSeeded,
  getTemplate,
  listWorkflows,
  validateDefinition,
} from '@/lib/scrapeflow'
import { crawlerEnabled } from '@/lib/crawler'
import { aiEnabled } from '@/lib/scrapeflow/ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

// GET — list workflows (+ registry, templates, environment capabilities)
export async function GET() {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const seeded = await ensureSeeded()
  const workflows = await listWorkflows()
  return NextResponse.json({
    workflows,
    seeded,
    tasks: TaskRegistry,
    templates: WORKFLOW_TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: t.description })),
    capabilities: {
      ai: aiEnabled(),
      crawl4ai: crawlerEnabled(),
      puppeteer: (process.env.SCRAPEFLOW_BROWSER || '').toLowerCase() === 'puppeteer',
    },
  })
}

// POST — create a workflow from a definition or a template
export async function POST(request: NextRequest) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  let definition = body.definition
  let name = String(body.name || '').trim()
  let description = body.description ? String(body.description) : null
  if (body.template_key) {
    const tpl = getTemplate(String(body.template_key))
    if (!tpl) return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
    definition = definition || tpl.definition
    name = name || `${tpl.name} (copy)`
    description = description ?? tpl.description
  }
  const valid = validateDefinition(definition)
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const workflow = await createWorkflow({
    name,
    description,
    definition: valid.definition,
    enabled: Boolean(body.enabled),
    interval_hours: Number(body.interval_hours) || 24,
  })
  return NextResponse.json({ workflow }, { status: 201 })
}
