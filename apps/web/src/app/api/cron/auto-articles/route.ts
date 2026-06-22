import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DISABLED: the auto-article LLM generator (packages/lib/src/content/auto-article-agent.ts)
// still targets Supabase. It overlaps the worker brief-automation pipeline (which now
// writes to Firestore via /api/ingest/brief) and requires its own LLM API key.
// Left as a no-op so nothing writes to Supabase. Port the agent's DB layer to Firestore
// (same collections as the creator/articles route) to re-enable.
export async function GET() {
  return NextResponse.json(
    { ok: false, disabled: true, message: 'auto-articles generator is disabled pending Firestore migration' },
    { status: 200 }
  )
}
