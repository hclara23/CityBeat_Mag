import { NextRequest, NextResponse } from 'next/server'
import { runAutoArticleAgent } from '@citybeat/lib/content/auto-articles'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

function parseLimit(value: string | null) {
  const parsed = Number(value || process.env.AUTO_ARTICLE_DAILY_LIMIT || 3)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(1, Math.min(Math.trunc(parsed), 5))
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const result = await runAutoArticleAgent({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ownerEmail: process.env.AUTO_ARTICLE_OWNER_EMAIL || 'citybeat@yahoo.com',
    limit: parseLimit(searchParams.get('limit')),
    dryRun: searchParams.get('dryRun') === '1',
  })

  return NextResponse.json(result)
}
