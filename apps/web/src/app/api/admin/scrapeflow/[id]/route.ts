import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { deleteWorkflow, getWorkflow, listRuns, updateWorkflow, validateDefinition } from '@/lib/scrapeflow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

// GET — one workflow + its recent runs
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workflow = await getWorkflow(params.id)
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const runs = await listRuns(params.id, 10)
  return NextResponse.json({ workflow, runs })
}

// PATCH — update name/description/definition/enabled/interval
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.description !== undefined) patch.description = body.description
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  if (body.interval_hours !== undefined) patch.interval_hours = Number(body.interval_hours)
  if (body.definition !== undefined) {
    const valid = validateDefinition(body.definition)
    if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 })
    patch.definition = valid.definition
  }
  const workflow = await updateWorkflow(params.id, patch)
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ workflow })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ok = await deleteWorkflow(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
