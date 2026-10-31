import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { checkRateLimit } from '@/lib/auth-security'
import { PortfolioError, requirePortfolio } from '@/lib/property-portfolio-policy'
import { propertyPortfolioService } from '@/lib/property-portfolio-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
function failure(error: unknown) {
  return NextResponse.json({ code: error instanceof PortfolioError ? error.code : 'temporarily_unavailable' }, { status: error instanceof PortfolioError ? error.status : 503 })
}
export async function GET() {
  try {
    const user = await getServerUser(); requirePortfolio(user, 'sign_in_required', 401)
    const data = (await adminDb.collection('property_company_claims').doc(`new_company_${user.id}`).get()).data()
    return NextResponse.json({ request: data ? { status: data.status, company_id: data.company_id, name: data.proposed_company?.name, note: data.review_note || '' } : null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest) {
  try {
    requirePortfolio(trustedSignInOrigin(request.headers.get('origin'), process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'), 'invalid_origin', 403)
    const user = await getServerUser(); requirePortfolio(user, 'sign_in_required', 401)
    requirePortfolio((await checkRateLimit(`property-company-register:${user.id}`, { max: 5, windowMs: 3600000 })).ok, 'try_later', 429)
    return NextResponse.json(await propertyPortfolioService(adminDb, adminAuth).registerCompany(user, await request.json()))
  } catch (error) { return failure(error) }
}
