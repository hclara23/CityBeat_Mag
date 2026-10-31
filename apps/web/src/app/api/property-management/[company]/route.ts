import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminAuth, adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { checkRateLimit } from '@/lib/auth-security'
import { publicPropertyCompany } from '@/lib/property-company-public'
import { propertyPortfolioService } from '@/lib/property-portfolio-service'
import { propertyPortfolioBilling } from '@/lib/property-portfolio-billing'
import { PortfolioError, requirePortfolio } from '@/lib/property-portfolio-policy'
import { bumpDirectoryIndexVersion } from '@/lib/directory-index-version'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co').origin
const service = () => propertyPortfolioService(adminDb, adminAuth)
type Context = { params: Promise<{ company: string }> }
function failure(error: unknown) {
  if (error instanceof PortfolioError) return NextResponse.json({ code: error.code }, { status: error.status })
  console.error('Property portfolio request failed', error instanceof Error ? error.message : 'Unknown error')
  return NextResponse.json({ code: 'temporarily_unavailable' }, { status: 503 })
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { company } = await context.params, user = await getServerUser()
    requirePortfolio(user, 'sign_in_required', 401)
    requirePortfolio(await publicPropertyCompany(company), 'company_not_found', 404)
    return NextResponse.json(await service().snapshot(company, user), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    requirePortfolio(trustedSignInOrigin(request.headers.get('origin'), origin), 'invalid_origin', 403)
    const { company } = await context.params, user = await getServerUser()
    requirePortfolio(user, 'sign_in_required', 401)
    requirePortfolio(await publicPropertyCompany(company), 'company_not_found', 404)
    requirePortfolio(user.email_verified, 'verified_email_required', 403)
    requirePortfolio((await checkRateLimit(`property-portfolio:${user.id}`, { max: 30, windowMs: 600000 })).ok, 'try_later', 429)
    const input = await request.json().catch(() => ({})), api = service()
    let result: unknown
    switch (input.action) {
      case 'claim': result = await api.claim(company, user, input); break
      case 'new_property': result = await api.addProperty(company, user.id, input); break
      case 'bulk_edit': result = await api.bulkEdit(company, user.id, input); break
      case 'assign_manager':
        requirePortfolio(typeof input.listing_id === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(input.listing_id) && typeof input.email === 'string' && input.email.length <= 254, 'invalid_property', 400)
        result = await api.assign(company, user.id, input.listing_id, input.email); break
      case 'checkout': case 'portal': case 'quote_addition': case 'enroll': {
        requirePortfolio(process.env.STRIPE_SECRET_KEY, 'billing_unavailable', 503)
        const billing = propertyPortfolioBilling(adminDb, new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' }), origin)
        if (input.action === 'checkout') {
          requirePortfolio(input.recurring_consent === true, 'recurring_consent_required', 400)
          result = await billing.checkout(company, user, input.locale, input.monthly_cents)
        } else if (input.action === 'portal') result = await billing.portal(company, user.id, input.locale)
        else if (input.action === 'quote_addition') result = await billing.quoteAddition(company, user.id)
        else {
          requirePortfolio(input.recurring_consent === true, 'recurring_consent_required', 400)
          result = await billing.enroll(company, user.id, input.quote_id, input.due_cents, input.monthly_cents)
        }
        break
      }
      default: throw new PortfolioError('invalid_action', 400)
    }
    if (input.action === 'bulk_edit') await bumpDirectoryIndexVersion('property-portfolio:bulk-edit')
    return NextResponse.json(result)
  } catch (error) { return failure(error) }
}
