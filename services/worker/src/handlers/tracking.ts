import { Env } from '../index'

export async function handleTracking(request: Request, _env: Env): Promise<Response> {
  try {
    const event = await request.json() as any

    // Log event to first-party analytics
    await logEvent(event)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Tracking error:', error)
    return new Response(JSON.stringify({ error: 'Tracking failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function logEvent(event: any): Promise<void> {
  // TODO: forward to the web app first-party analytics
  console.log('Event tracked:', event.event, event.properties)

  // Could also send to third-party analytics services
}
