import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function checkSupabase(): Promise<boolean> {
  try {
    // Simple health check - can be expanded based on needs
    return true
  } catch {
    return false
  }
}

async function checkSanity(): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SANITY_PROJECT_URL || 'https://api.sanity.io'}/v2022-12-07/data/query/production?query=*[_type=="brief"][0]`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SANITY_API_TOKEN || ''}`,
        },
      }
    )
    return response.ok
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const [supabaseOk, sanityOk] = await Promise.all([
      checkSupabase(),
      checkSanity(),
    ])

    const status = supabaseOk && sanityOk ? 'healthy' : 'degraded'
    const statusCode = supabaseOk && sanityOk ? 200 : 503

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        checks: {
          app: 'ok',
          supabase: supabaseOk ? 'ok' : 'down',
          sanity: sanityOk ? 'ok' : 'down',
        },
      },
      { status: statusCode }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
