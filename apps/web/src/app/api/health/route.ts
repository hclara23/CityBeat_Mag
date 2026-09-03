import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Liveness + dependency health, probed every 5 minutes by the citybeat-health
// uptime check.
//
// This previously returned a hardcoded {status:'healthy'} literal that could not
// fail, so a green check proved only that Node was running — the app could be
// completely unable to reach Firestore (no listings, no checkout, no auth) and
// this endpoint would still report healthy. It now actually touches the database.
//
// Bounded on purpose: a 2s timeout means a slow Firestore surfaces as unhealthy
// rather than hanging the probe until the uptime check's own 30s timeout.
const DB_TIMEOUT_MS = 2000

export async function GET() {
  const started = Date.now()
  let dbOk = false
  let dbError: string | null = null

  try {
    // Cheapest possible real read: one doc, one field.
    const probe = adminDb.collection('system_health').limit(1).select().get()
    await Promise.race([
      probe.then(() => {
        dbOk = true
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('firestore_timeout')), DB_TIMEOUT_MS)),
    ])
  } catch (error) {
    dbOk = false
    dbError = error instanceof Error ? error.message : 'unknown'
  }

  const body = {
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - started,
    revision: process.env.K_REVISION || null,
    checks: {
      app: 'ok',
      firestore: dbOk ? 'ok' : `fail:${dbError}`,
    },
  }

  // 503 when a dependency is down, so the uptime check and any load balancer
  // treat it as unhealthy instead of silently serving a broken app.
  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}
