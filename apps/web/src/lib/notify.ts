import { Novu } from '@novu/api'

// Unified notifications via Novu (email + SMS + push + in-app inbox from one API).
// Dormant + never throws until NOVU_SECRET_KEY is set. `workflowId` is a workflow
// trigger identifier you create in the Novu dashboard; `to` is the subscriber —
// normally the user's uid (attach their email/phone once so channels resolve).

let cached: Novu | null | undefined

function getClient(): Novu | null {
  if (cached !== undefined) return cached
  const key = process.env.NOVU_SECRET_KEY
  if (!key) {
    cached = null
    return cached
  }
  try {
    cached = new Novu({ secretKey: key })
  } catch {
    cached = null
  }
  return cached
}

export function notificationsEnabled(): boolean {
  return getClient() !== null
}

export async function notify(params: {
  workflowId: string
  to: string | { subscriberId: string; email?: string; phone?: string; firstName?: string }
  payload?: Record<string, unknown>
}): Promise<{ sent: boolean }> {
  const novu = getClient()
  if (!novu) return { sent: false }
  try {
    const to = typeof params.to === 'string' ? { subscriberId: params.to } : params.to
    await novu.trigger({ workflowId: params.workflowId, to: to as any, payload: params.payload || {} })
    return { sent: true }
  } catch {
    // Notifications must never break the flow that triggered them.
    return { sent: false }
  }
}
