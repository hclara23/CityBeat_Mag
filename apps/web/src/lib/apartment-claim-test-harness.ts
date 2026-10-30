import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as security from './directory-security'
import * as consent from './claim-sms-consent'
import * as salesDirectory from './sales-directory'
import { toE164 } from './sms'

// Execute the production HTTP handlers, not a copy of their claim algorithm.
// Only external boundaries are replaced; any unexpected dependency fails closed.
export function harness() {
  const records = new Map<string, Record<string, any>>()
  let sequence = 0
  let user: { id: string } | null = { id: 'manager-a' }
  let rateAllowed = true
  let sent = true
  let admin = false
  const messages: { to: string; body: string }[] = []
  const events: Record<string, unknown>[] = []
  const snapshot = (path: string): any => ({
    id: path.split('/').pop(), exists: records.has(path), ref: reference(path),
    data: () => records.get(path),
  })
  const reference = (path: string): any => ({
    path, id: path.split('/').pop(), get: async () => snapshot(path),
    set: async (value: Record<string, unknown>, opts?: { merge?: boolean }) => {
      records.set(path, opts?.merge ? { ...records.get(path), ...value } : { ...value })
    },
    delete: async () => { records.delete(path) },
  })
  const collection = (name: string, filters: [string, string, unknown][] = [], cap = Infinity): any => ({
    doc: (id: string) => reference(`${name}/${id}`),
    add: async (value: Record<string, unknown>) => {
      const ref = reference(`${name}/test-${++sequence}`)
      await ref.set(value)
      return ref
    },
    where: (field: string, operator: string, value: unknown) => {
      assert.ok(['==', 'in'].includes(operator))
      return collection(name, [...filters, [field, operator, value]], cap)
    },
    limit: (value: number) => collection(name, filters, value),
    get: async () => {
      const docs = [...records].filter(([path, value]) => path.startsWith(`${name}/`) && filters.every(([field, operator, match]) => operator === 'in' ? (match as unknown[]).includes(value[field]) : value[field] === match)).slice(0, cap).map(([path]) => snapshot(path))
      return { empty: docs.length === 0, size: docs.length, docs }
    },
  })
  const db = {
    collection,
    runTransaction: async (action: (tx: any) => Promise<unknown>) => action({
      get: (ref: any) => ref.get(),
      create: (ref: any, value: Record<string, unknown>) => { assert.equal(records.has(ref.path), false, 'create must never overwrite'); return ref.set(value) },
      set: (ref: any, value: Record<string, unknown>, opts?: { merge?: boolean }) => ref.set(value, opts),
    }),
  }
  const overrides: Record<string, unknown> = {
    'next/server': { NextRequest: Request, NextResponse: { json: (body: unknown, opts?: { status?: number }) => Response.json(body, opts) } },
    '@citybeat/lib/firebase/server': { getServerUser: async () => user, getServerUserProfile: async () => ({ role: admin ? 'admin' : 'user', mfa_enabled: admin }) },
    '@citybeat/lib/roles': { hasAdminAccess: (profile: any) => profile.role === 'admin' },
    '@/lib/directory-index-version': { bumpDirectoryIndexVersion: async () => undefined },
    '@/lib/user-notifications': { notifyUser: async () => undefined },
    '@/lib/platform/stripe-connect': { getStripe: () => { throw new Error('Free claim must not call Stripe') } },
    '@citybeat/lib/firebase/admin': { adminDb: db },
    'firebase-admin/firestore': { FieldValue: { serverTimestamp: () => new Date().toISOString() } },
    '@/lib/directory-security': security,
    '@/lib/claim-sms-consent': consent,
    '@/lib/sales-directory': salesDirectory,
    '@/lib/auth-security': { checkRateLimit: async () => ({ ok: rateAllowed }) },
    '@/lib/email': { sendEmail: async () => { throw new Error('SMS flow must not email') } },
    '@/lib/sms': { toE164, sendSms: async (to: string, body: string) => { messages.push({ to, body }); return { sent, error: sent ? undefined : 'twilio_400_30034' } } },
    '@/lib/alerts': { reportFailure: async () => undefined },
    '@/lib/claim-funnel': { recordClaimEvent: async (event: Record<string, unknown>) => { events.push(event) } },
    crypto: { randomInt: () => 654321 },
  }
  const root = fileURLToPath(new URL('../', import.meta.url))
  function load(path: string): any {
    const mod = { exports: {} }
    const output = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    runInNewContext(output, {
      module: mod, exports: mod.exports, console, Date, URL,
      require: (id: string) => {
        if (id in overrides) return overrides[id]
        // Pure local message/error copy may be added without mocking its behavior.
        if (id.startsWith('@/')) return load(resolve(root, id.slice(2)) + '.ts')
        if (id.startsWith('.')) return load(resolve(dirname(path), id) + '.ts')
        throw new Error(`Unexpected dependency: ${id}`)
      },
    }, { filename: path })
    return mod.exports
  }
  const start = load(resolve(root, 'app/api/directory/[id]/claim/start/route.ts')).POST
  const verify = load(resolve(root, 'app/api/directory/[id]/claim/verify/route.ts')).POST
  const apartmentGet = load(resolve(root, 'app/api/apartments/[slug]/claim/route.ts')).GET
  const apartmentStart = load(resolve(root, 'app/api/apartments/[slug]/claim/start/route.ts')).POST
  const apartmentVerify = load(resolve(root, 'app/api/apartments/[slug]/claim/verify/route.ts')).POST
  const approve = load(resolve(root, 'app/api/admin/claims/[id]/route.ts')).POST
  const resolver = load(resolve(root, 'lib/apartment-listing.ts')).resolveApartmentListing
  return {
    records, messages, events,
    currentUser: () => user,
    apartmentGet(slug = 'alza-dwellings') {
      return apartmentGet(new Request('https://example.invalid/api/apartments/' + slug + '/claim'), { params: Promise.resolve({ slug }) }) as Promise<Response>
    },
    approve(id: string) { admin = true; return approve({ json: async () => ({ action: 'approve' }) }, { params: Promise.resolve({ id }) }) as Promise<Response> },
    resolve: (slug: string, create = false) => resolver(db, slug, create),
    apartmentStart(body: Record<string, unknown> = {}, slug = 'alza-dwellings') {
      return apartmentStart(new Request('https://example.invalid/api/apartments/' + slug + '/claim/start', { method: 'POST', body: JSON.stringify({ smsConsent: true, smsConsentVersion: consent.CLAIM_SMS_CONSENT_VERSION, locale: 'en', ...body }) }), { params: Promise.resolve({ slug }) }) as Promise<Response>
    },
    apartmentVerify(body: Record<string, unknown> = { code: '654321' }, slug = 'alza-dwellings') {
      return apartmentVerify(new Request('https://example.invalid/api/apartments/' + slug + '/claim/verify', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ slug }) }) as Promise<Response>
    },
    setUser(value: { id: string } | null) { user = value },
    setRate(value: boolean) { rateAllowed = value },
    setSent(value: boolean) { sent = value },
    seed(id = 'property', data: Record<string, unknown> = {}) {
      records.set(`directory_listings/${id}`, { name: 'ALZA Dwellings', phone: '9152655427', claim_status: 'unclaimed', tier: 'basic', ...data })
    },
    claims() { return [...records].filter(([key]) => key.startsWith('directory_claims/')).map(([, value]) => value) },
    start(body: Record<string, unknown> = {}, id = 'property') {
      return start({ json: async () => ({ method: 'phone', smsConsent: true, smsConsentVersion: consent.CLAIM_SMS_CONSENT_VERSION, locale: 'en', ...body }) }, { params: Promise.resolve({ id }) }) as Promise<Response>
    },
    verify(body: Record<string, unknown> = { code: '654321' }, id = 'property') {
      return verify({ json: async () => body }, { params: Promise.resolve({ id }) }) as Promise<Response>
    },
  }
}

