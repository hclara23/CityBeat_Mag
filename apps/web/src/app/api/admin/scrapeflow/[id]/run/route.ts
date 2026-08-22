import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { getWorkflow, runWorkflow } from '@/lib/scrapeflow'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

async function requireDeveloper() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasDeveloperAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  return { user }
}

// POST — run a workflow now. Body: { dryRun?: boolean }. Dry run executes every
// phase (including AI extraction) but the directory sink only reports what it
// WOULD insert — the safe way to preview a new source.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDeveloper()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workflow = await getWorkflow(params.id)
  if (!workflow) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const dryRun = Boolean(body.dryRun)
  try {
    const run = await runWorkflow(workflow, { trigger: 'manual', dryRun })
    return NextResponse.json({ run })
  } catch (error) {
    await reportFailure('scrapeflow:manual-run', error, { workflow_id: params.id, dryRun })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Run failed' }, { status: 500 })
  }
}
