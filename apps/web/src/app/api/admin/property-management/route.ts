import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { propertyPortfolioService } from '@/lib/property-portfolio-service'
import { PortfolioError, requirePortfolio } from '@/lib/property-portfolio-policy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
async function staff() {
  const user = await getServerUser()
  requirePortfolio(user, 'sign_in_required', 401)
  const profile = await getServerUserProfile(user.id)
  requirePortfolio(hasEditorAccess(profile) && profile?.mfa_enabled, 'staff_mfa_required', 403)
  return user
}
function failure(error: unknown) {
  return NextResponse.json({ code: error instanceof PortfolioError ? error.code : 'temporarily_unavailable' }, { status: error instanceof PortfolioError ? error.status : 503 })
}
export async function GET() {
  try {
    await staff()
    const [claims, properties] = await Promise.all([
      adminDb.collection('property_company_claims').where('status', '==', 'pending').limit(100).get(),
      adminDb.collection('directory_listings').where('property_review', '==', 'pending').limit(200).get(),
    ])
    return NextResponse.json({ claims: claims.docs.map(d => ({ ...d.data(), id: d.id })),
      properties: properties.docs.map(d => ({ ...d.data(), id: d.id })) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  try {
    requirePortfolio(trustedSignInOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'), 'invalid_origin', 403)
    const user = await staff(), input = await request.json(), service = propertyPortfolioService(adminDb, adminAuth)
    requirePortfolio(typeof input.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(input.id), 'invalid_property', 400)
    const note = String(input.note || '').trim()
    requirePortfolio(note.length >= 20 && note.length <= 3000 && typeof input.approved === 'boolean', 'review_note_required', 400)
    if (input.approved) requirePortfolio(input.authority_checked === true, 'authority_confirmation_required', 400)
    if (input.kind === 'property') return NextResponse.json(await service.reviewProperty(input.id, user.id, note, input.approved))
    requirePortfolio(input.kind === 'claim', 'invalid_action', 400)
    if (input.approved) return NextResponse.json(await service.approveClaim(input.id, user.id, note))
    const ref = adminDb.collection('property_company_claims').doc(input.id)
    await adminDb.runTransaction(async tx => {
      requirePortfolio((await tx.get(ref)).data()?.status === 'pending', 'claim_not_pending')
      tx.set(ref, { status: 'rejected', review_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }, { merge: true })
    })
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
