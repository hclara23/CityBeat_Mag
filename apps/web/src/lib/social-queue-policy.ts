export const OFFICIAL_PAGE_ID = '112338362142224'
export const QUEUE_MODEL = 'gpt-4.1-mini-2025-04-14'
export const MONTHLY_LIMIT_CENTS = 500
// Reserve, never refund, 10 cents per item before any request. Each item makes
// at most four calls, each <= 8K text bytes + one 1024px image + 600 output tokens.
// At the approved snapshot pricing this substantially exceeds worst-case cost.
export const ITEM_RESERVATION_CENTS = 10
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function canReserve(used: number): boolean {
  return Number.isFinite(used) && used >= 0 && used + ITEM_RESERVATION_CENTS <= MONTHLY_LIMIT_CENTS
}

export function parseCaption(value: unknown): string {
  const caption = (value as { caption?: unknown })?.caption
  if (typeof caption !== 'string' || !caption.trim() || caption.length > 1200) throw new Error('Invalid caption response')
  return caption.trim()
}

export function parseReview(value: unknown): { approved: boolean; reason: string } {
  const v = value as { approved?: unknown; reason?: unknown }
  if (typeof v?.approved !== 'boolean' || typeof v.reason !== 'string' || !v.reason.trim() || v.reason.length > 800) {
    throw new Error('Invalid review response')
  }
  return { approved: v.approved, reason: v.reason.trim() }
}

export function safeNotes(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 1000) : ''
}
