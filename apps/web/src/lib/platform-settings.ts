import { adminDb } from '@citybeat/lib/firebase/admin'

// Godmode-controlled platform behavior flags (separate from payout %s).
export type PlatformSettings = {
  // When true, a self-serve owner who pays for a directory claim is approved
  // instantly (skips manual admin review). Default OFF — preserves human review.
  auto_approve_claims: boolean
  // When true, the autonomous newsroom (cron/auto-articles) publishes its briefs
  // immediately instead of saving them as drafts for review. Default OFF.
  newsroom_auto_publish: boolean
  updated_at?: string
  updated_by?: string
}

const DEFAULTS: PlatformSettings = { auto_approve_claims: false, newsroom_auto_publish: false }
const DOC = () => adminDb.collection('settings').doc('platform')

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const doc = await DOC().get()
    const data = doc.exists ? (doc.data() as any) : {}
    return {
      auto_approve_claims: Boolean(data?.auto_approve_claims),
      newsroom_auto_publish: Boolean(data?.newsroom_auto_publish),
      updated_at: data?.updated_at,
      updated_by: data?.updated_by,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function savePlatformSettings(patch: Partial<PlatformSettings>, updatedBy: string): Promise<PlatformSettings> {
  await DOC().set({ ...patch, updated_at: new Date().toISOString(), updated_by: updatedBy }, { merge: true })
  return getPlatformSettings()
}
