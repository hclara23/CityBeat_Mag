import { FOUNDING_LIMIT } from './pricing'

export type FoundingSlot = {
  key: string; attempt: string; state: 'pending' | 'open' | 'paid';
  sessionId?: string; expiresAt?: number; params?: Record<string, any>;
}
export function allocateFoundingSlot(slots: FoundingSlot[], candidate: FoundingSlot) {
  const existing = slots.find(slot => slot.key === candidate.key)
  if (existing) return { slots, slot: existing }
  if (new Set(slots.map(slot => slot.key)).size >= FOUNDING_LIMIT) throw new Error('The first 100 Founders places are taken or reserved. Please try later or choose regular Premium at $19.99/month.')
  return { slots: [...slots, candidate], slot: candidate }
}
export function reconcileFoundingSlot(slot: FoundingSlot, session: { id: string; status: string | null; payment_status?: string }) {
  if (slot.state === 'paid' || slot.sessionId !== session.id) return slot
  if (session.status === 'expired' && session.payment_status !== 'paid') return null
  if (session.status === 'complete' || session.payment_status === 'paid') return { ...slot, state: 'paid' as const, params: undefined }
  return slot
}
