import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { checkRateLimit } from '@/lib/auth-security'
import { PortfolioError, requirePortfolio } from '@/lib/property-portfolio-policy'
import { propertyImportService } from '@/lib/property-import-service'
import { importCapabilities, importWebsite, importBrochure, enrichImportDraft, IMPORT_MAX_BYTES } from '@/lib/property-import-providers'
import { bumpDirectoryIndexVersion } from '@/lib/directory-index-version'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
type Context = { params: Promise<{ company: string }> }
const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co').origin
const headers = { 'Cache-Control': 'private, no-store' }
function failure(error: unknown) {
  if (error instanceof PortfolioError) return NextResponse.json({ code: error.code }, { status: error.status, headers })
  return NextResponse.json({ code: 'import_provider_unavailable' }, { status: 503, headers })
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getServerUser(), { company } = await context.params
    requirePortfolio(user, 'sign_in_required', 401)
    requirePortfolio(user?.email_verified, 'verified_email_required', 403)
    await propertyImportService(adminDb).access(company, user.id, '')
    return NextResponse.json(importCapabilities(), { headers })
  } catch (error) { return failure(error) }
}
async function boundedBody(request: NextRequest) {
  const limit = IMPORT_MAX_BYTES + 65536
  requirePortfolio(Number(request.headers.get('content-length') || 0) <= limit && request.body, 'import_source_too_large', 413)
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      size += value.byteLength; requirePortfolio(size <= limit, 'import_source_too_large', 413); chunks.push(value)
    }
  } finally { await reader.cancel() }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } })
}
export async function POST(request: NextRequest, context: Context) {
  try {
    requirePortfolio(trustedSignInOrigin(request.headers.get('origin'), origin), 'invalid_origin', 403)
    const user = await getServerUser(), { company } = await context.params, api = propertyImportService(adminDb)
    requirePortfolio(user, 'sign_in_required', 401)
    requirePortfolio(user.email_verified, 'verified_email_required', 403)
    await api.access(company, user.id, '')
    requirePortfolio((await checkRateLimit(`property-import:${user.id}`, { max: 6, windowMs: 3600000 })).ok, 'try_later', 429)
    const caps = importCapabilities()
    requirePortfolio(caps.enabled, 'import_disabled', 503)
    const body = await boundedBody(request)
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = await body.json().catch(() => null)
      requirePortfolio(input?.action === 'apply', 'invalid_action', 400)
      const result = await api.apply(company, user.id, input)
      await bumpDirectoryIndexVersion('property-import:reviewed-apply')
      return NextResponse.json(result, { headers })
    }
    const form = await body.formData().catch(() => null)
    requirePortfolio(form, 'invalid_brochure', 400)
    const kind = form.get('kind'), target = String(form.get('target') || ''), useAI = form.get('ai') === 'true'
    requirePortfolio(kind === 'website' || kind === 'brochure', 'invalid_action', 400)
    await api.access(company, user.id, target)
    requirePortfolio(kind === 'website' ? caps.website : caps.brochure, kind === 'website' ? 'import_website_disabled' : 'import_brochure_disabled', 503)
    requirePortfolio(!useAI || caps.ai, 'import_ai_disabled', 503)
    const file = form.get('brochure')
    if (kind === 'brochure') requirePortfolio(file instanceof File && file.size > 0 && file.size <= IMPORT_MAX_BYTES, 'invalid_brochure', 400)
    await api.reserve(company, user.id, kind, useAI)
    let draft = kind === 'website' ? await importWebsite(String(form.get('website') || '')) : await importBrochure(Buffer.from(await (file as File).arrayBuffer()), (file as File).name)
    if (useAI) draft = await enrichImportDraft(draft)
    return NextResponse.json(await api.prepare(company, user.id, target, draft), { headers })
  } catch (error) { return failure(error) }
}
