import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function checkStripe(): Promise<boolean> {
  try {
    // Check if Stripe key is configured
    return !!process.env.STRIPE_SECRET_KEY
  } catch {
    return false
  }
}

async function checkFirebase(): Promise<boolean> {
  try {
    return !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const [stripeOk, firebaseOk] = await Promise.all([
      checkStripe(),
      checkFirebase(),
    ])

    const status = stripeOk && firebaseOk ? 'healthy' : 'degraded'
    const statusCode = stripeOk && firebaseOk ? 200 : 503

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        checks: {
          app: 'ok',
          stripe: stripeOk ? 'ok' : 'down',
          firebase: firebaseOk ? 'ok' : 'down',
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
