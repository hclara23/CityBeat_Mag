import { adminDb } from '@citybeat/lib/firebase/admin'
import { createHash } from 'node:crypto'
import { permittedSource, sportsUpdate, type SportsSource } from './sports-policy'

export const sportsSources = () => adminDb.collection('sports_sources')
export async function ingestSportsUpdate(sourceId: string, input: Record<string, unknown>) {
  const update = sportsUpdate(input)
  const id = createHash('sha256').update(`${sourceId}:${update.external_id}`).digest('hex')
  const ref = adminDb.collection('sports_updates').doc(id)
  const dayRef = adminDb.collection('automation_budgets').doc(`sports-${sourceId}-${new Date().toISOString().slice(0, 10)}`)
  return adminDb.runTransaction(async tx => {
    const [sourceSnap, existing, daily] = await Promise.all([tx.get(sportsSources().doc(sourceId)), tx.get(ref), tx.get(dayRef)])
    const source = sourceSnap.data() as SportsSource | undefined
    if (!permittedSource(source)) throw new Error('Source disabled or publication permission expired')
    if (existing.exists) return { id, duplicate: true }
    const count = daily.data()?.count || 0
    if (count >= 20) throw new Error('Source daily limit reached')
    tx.set(dayRef, { count: count + 1 })
    tx.create(ref, { ...update, source_id: sourceId, source_name: source!.name, status: 'published',
      permission_basis: source!.permission_basis, permission_evidence: source!.permission_evidence,
      received_at: Date.now() })
    return { id, duplicate: false }
  })
}

export async function getSportsUpdates() {
  const [updates, sources] = await Promise.all([
    adminDb.collection('sports_updates').orderBy('published_at', 'desc').limit(80).get(), sportsSources().limit(100).get(),
  ])
  const allowed = new Set(sources.docs.filter(doc => permittedSource(doc.data() as SportsSource)).map(doc => doc.id))
  return updates.docs.filter(doc => allowed.has(doc.data().source_id) && doc.data().status === 'published')
    .map(doc => ({ id: doc.id, ...doc.data() } as { id: string; title: string; body: string; author: string; source_name: string; source_url: string | null; published_at: string })).slice(0, 40)
}
