import { assessLocality } from '@citybeat/lib/directory/quality'
import { isGoogleMapsContent } from './scrapeflow/google-content'
import { auditDirectoryPublication } from './directory-publication'

export class ImportReviewError extends Error {}
export function reviewImportEdit(current: Record<string, any>, updates: Record<string, any>, body: Record<string, any>, actor: string, now: string) {
  const candidate = { ...current, ...updates }
  const approving = body.approve_import_review === true
  if (approving) {
    if (current.publication_hold !== 'import_quality_review') throw new ImportReviewError('Only an import-quality hold can be cleared here.')
    if (isGoogleMapsContent(current)) throw new ImportReviewError('Restricted source records need a separate provenance review.')
    const source = String(body.review_source_url || '').trim()
    try { if (!['http:', 'https:'].includes(new URL(source).protocol)) throw new Error() }
    catch { throw new ImportReviewError('A valid source URL is required.') }
    const notes = String(body.review_notes || '').trim()
    if (body.duplicate_review_confirmed !== true || notes.length < 20 || notes.length > 2000) throw new ImportReviewError('Confirm duplicate review and record 20–2,000 characters of location, source and operating-status evidence.')
    // A staff-corrected full address supersedes stale structured import fields.
    const locality = assessLocality({ address: candidate.address })
    if (locality.status !== 'inside') throw new ImportReviewError('Correct the address to one of the eleven permitted cities and its state before approval.')
    const checked = { ...candidate, city: locality.city, state: locality.state, id: 'review', is_published: false, publication_hold: null, source_url: source }
    if (!auditDirectoryPublication([checked]).eligible) throw new ImportReviewError('The listing still fails publication checks. Review its source, category, contact details and business status.')
    return { publication_hold: null, quality_review_status: 'approved', quality_review_reasons: [],
      city: locality.city, state: locality.state, locality_status: 'inside',
      last_verified_at: now, verified_by: actor, verification_method: 'staff_evidence_review',
      verification_notes: notes, source_url: source, original_source_url: current.original_source_url || current.source_url || null }
  }
  if (updates.is_published === true && (current.publication_hold || current.quality_review_status === 'pending')) throw new ImportReviewError('Complete the import review before publishing this listing.')
  if (updates.is_published === true && (!current.is_published || updates.address !== undefined && updates.address !== current.address) && assessLocality(candidate).status !== 'inside') {
    throw new ImportReviewError('Publication requires an address in one of the eleven permitted cities and its state.')
  }
  return {}
}
