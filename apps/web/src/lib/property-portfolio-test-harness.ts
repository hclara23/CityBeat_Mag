import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import type { Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import type Stripe from 'stripe'
import * as policy from './property-portfolio-policy'
import * as serviceModule from './property-portfolio-service'
import * as billingModule from './property-portfolio-billing'
import { getPropertyCompany } from './property-companies'
import { trustedSignInOrigin } from './google-signin-policy'

/** Isolated infrastructure for production service/HTTP tests; no network SDKs. */
export function portfolioHarness() {
  const records = new Map<string, any>(), users = new Map<string, any>()
  let sequence = 0, queue = Promise.resolve(), user: any = { id: 'corporate', email: 'corporate@example.test', email_verified: true }
  let staff = false, rate = true
  const clone = (x: any) => x === undefined ? undefined : structuredClone(x)
  const snapshot = (path: string): any => ({ id: path.split('/').pop(), exists: records.has(path), ref: reference(path), data: () => clone(records.get(path)) })
  const reference = (path: string): any => ({ path, id: path.split('/').pop(), get: async () => snapshot(path),
    set: async (data: any, options?: any) => { records.set(path, options?.merge ? { ...clone(records.get(path)), ...clone(data) } : clone(data)) },
    delete: async () => { records.delete(path) } })
  const collection = (name: string, filters: any[] = [], limit = Infinity): any => ({
    doc: (id = `fixture-${++sequence}`) => reference(`${name}/${id}`),
    where: (field: string, op: string, value: any) => { assert.ok(['==', 'in'].includes(op)); return collection(name, [...filters, [field, op, value]], limit) },
    limit: (n: number) => collection(name, filters, n),
    get: async () => { const docs = [...records].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([field, op, value]) => op === 'in' ? value.includes(data[field]) : data[field] === value)).slice(0, limit).map(([path]) => snapshot(path)); return { docs, size: docs.length, empty: !docs.length } },
  })
  const db = { collection, getAll: async (...refs: any[]) => Promise.all(refs.map(ref => ref.get())),
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const previous = queue; let release!: () => void; queue = new Promise(resolve => { release = resolve }); await previous
      const writes: any[] = []; let wrote = false
      try {
        const result = await fn({ get: async (ref: any) => { assert.equal(wrote, false, 'Firestore transaction reads must precede writes'); return ref.get() },
          create: (ref: any, data: any) => { wrote = true; writes.push({ ref, data, create: true }) },
          set: (ref: any, data: any, options: any) => { wrote = true; writes.push({ ref, data, options }) } })
        const next = new Map(records)
        for (const write of writes) {
          if (write.create) assert.equal(next.has(write.ref.path), false, 'create cannot overwrite')
          next.set(write.ref.path, write.options?.merge ? { ...next.get(write.ref.path), ...clone(write.data) } : clone(write.data))
        }
        records.clear(); for (const [key, value] of next) records.set(key, value)
        return result
      } finally { release() }
    },
  } as unknown as Firestore
  users.set('corporate', { uid: 'corporate', email: 'corporate@example.test', emailVerified: true, disabled: false })
  users.set('manager', { uid: 'manager', email: 'manager@example.test', emailVerified: true, disabled: false })
  const auth = { getUser: async (id: string) => { assert.ok(users.has(id)); return clone(users.get(id)) },
    getUserByEmail: async (email: string) => { const found = [...users.values()].find(u => u.email === email); if (!found) throw new Error('not-found'); return clone(found) },
    getUsers: async (ids: { uid: string }[]) => ({ users: ids.flatMap(({ uid }) => users.has(uid) ? [clone(users.get(uid))] : []), notFound: [] }),
  } as unknown as Auth
  const sessions = new Map<string, any>(), subs = new Map<string, any>(), invoices = new Map<string, any>(), idempotency = new Map<string, any>()
  const calls: { method: string; input: any; options?: any }[] = []
  let decline = false
  const once = async (method: string, input: any, options: any, create: () => any) => {
    calls.push({ method, input: clone(input), options: clone(options) })
    const key = options?.idempotencyKey || `${method}:${++sequence}`
    if (!idempotency.has(key)) idempotency.set(key, create())
    return clone(idempotency.get(key))
  }
  const stripe = {
    customers: { create: (input: any, options: any) => once('customers.create', input, options, () => ({ id: `cus_${++sequence}` })) },
    checkout: { sessions: {
      create: (input: any, options: any) => once('checkout.create', input, options, () => { const id = `cs_${++sequence}`; const data = { ...input, id, status: 'open', url: `https://checkout.stripe.com/c/pay/${id}` }; sessions.set(id, data); return data }),
      retrieve: async (id: string) => { assert.ok(sessions.has(id)); return clone(sessions.get(id)) },
      list: async () => ({ data: [...sessions.values()].map(clone), has_more: false }),
    } },
    subscriptions: {
      retrieve: async (id: string) => { assert.ok(subs.has(id), `subscription ${id} exists`); return clone(subs.get(id)) },
      update: (id: string, input: any, options: any) => once('subscriptions.update', { id, ...input }, options, () => {
        const sub = clone(subs.get(id)); assert.ok(sub)
        if (!decline) sub.items.data[0].quantity = input.items[0].quantity
        sub.pending_update = decline ? { expires_at: Math.floor(Date.now() / 1000) + 86400 } : null
        sub.latest_invoice = { id: `in_add_${++sequence}`, status: decline ? 'open' : 'paid', hosted_invoice_url: 'https://invoice.stripe.com/i/fixture', charge: { refunded: false, disputed: false } }
        subs.set(id, sub); invoices.set(sub.latest_invoice.id, sub.latest_invoice); return sub
      }),
    },
    invoices: { retrieveUpcoming: async (input: any) => ({ discount: null, automatic_tax: { enabled: false }, lines: { has_more: false, data: [{ proration: true, amount: 500, period: { start: input.subscription_proration_date } }] } }),
      retrieve: async (id: string) => { assert.ok(invoices.has(id)); return clone(invoices.get(id)) } },
    billingPortal: { configurations: { create: (input: any, options: any) => once('portal.configuration', input, options, () => ({ id: 'bpc_fixture' })) },
      sessions: { create: async (input: any) => { calls.push({ method: 'portal.session', input }); return { url: 'https://billing.stripe.com/p/session/fixture' } } } },
    charges: { retrieve: async () => { throw new Error('Unexpected charge lookup in fixture') } },
  } as unknown as Stripe
  const service = serviceModule.propertyPortfolioService(db, auth), billing = billingModule.propertyPortfolioBilling(db, stripe, 'https://citybeatmag.co')
  function completeCheckout(id = [...sessions.keys()].at(-1)!) {
    const session = sessions.get(id), subId = `sub_${++sequence}`
    session.status = 'complete'; session.subscription = subId
    const price = session.line_items[0].price_data
    const sub = { id: subId, metadata: session.subscription_data.metadata, customer: session.customer, status: 'active', discount: null,
      items: { data: [{ id: `si_${sequence}`, quantity: session.line_items[0].quantity, price: { ...price, recurring: { interval: 'month', interval_count: 1 } } }] },
      latest_invoice: { id: `in_${sequence}`, status: 'paid', charge: { refunded: false, disputed: false } },
      cancel_at_period_end: false, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }
    subs.set(subId, sub); invoices.set(sub.latest_invoice.id, { ...sub.latest_invoice, subscription: subId }); return sub
  }
  async function event(sub: any, type = 'customer.subscription.updated') {
    return billingModule.handlePropertyPortfolioEvent({ id: `evt_${++sequence}`, type, data: { object: clone(sub) } } as any, stripe, db)
  }
  const overrides: Record<string, any> = {
    'next/server': { NextRequest: Request, NextResponse: { json: (body: any, options: any) => Response.json(body, options) } },
    'stripe': class { constructor() { return stripe } },
    '@citybeat/lib/firebase/admin': { adminDb: db, adminAuth: auth },
    '@citybeat/lib/firebase/server': { getServerUser: async () => user, getServerUserProfile: async () => ({ role: staff ? 'editor' : 'user', mfa_enabled: staff }) },
    '@citybeat/lib/roles': { hasEditorAccess: (p: any) => p.role === 'editor' },
    '@/lib/property-portfolio-service': serviceModule, '@/lib/property-portfolio-billing': billingModule,
    '@/lib/property-portfolio-policy': policy,
    '@/lib/property-company-public': { publicPropertyCompany: async (id: string) => getPropertyCompany(id) || records.get(`property_companies/${id}`) },
    '@/lib/google-signin-policy': { trustedSignInOrigin },
    '@/lib/auth-security': { checkRateLimit: async () => ({ ok: rate }) },
    '@/lib/directory-index-version': { bumpDirectoryIndexVersion: async () => undefined },
  }
  function loadRoute(relative: string): any {
    const path = fileURLToPath(new URL(`../app/api/${relative}/route.ts`, import.meta.url)), mod = { exports: {} }
    const output = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
    runInNewContext(output, { module: mod, exports: mod.exports, console, URL, Date, process: { env: { STRIPE_SECRET_KEY: 'sk_test_fixture', NEXT_PUBLIC_APP_URL: 'https://citybeatmag.co' } },
      require: (id: string) => { assert.ok(id in overrides, `Unexpected dependency ${id}`); return overrides[id] } }, { filename: path })
    return mod.exports
  }
  const route = loadRoute('property-management/[company]'), adminRoute = loadRoute('admin/property-management'), registerRoute = loadRoute('property-management/register')
  return { records, db, auth, stripe, service, billing, sessions, subs, invoices, calls, users, completeCheckout, event,
    setUser: (value: any) => { user = value }, setStaff: (value: boolean) => { staff = value }, setRate: (value: boolean) => { rate = value }, setDecline: (value: boolean) => { decline = value },
    get: (company = 'rpm-living') => route.GET(new Request('https://citybeatmag.co/api/property-management/' + company), { params: Promise.resolve({ company }) }) as Promise<Response>,
    post: (input: any, company = 'rpm-living', origin = 'https://citybeatmag.co') => route.POST(new Request('https://citybeatmag.co/api/property-management/' + company, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) }), { params: Promise.resolve({ company }) }) as Promise<Response>,
    admin: (input: any) => adminRoute.POST(new Request('https://citybeatmag.co/api/admin/property-management', { method: 'POST', headers: { origin: 'https://citybeatmag.co', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })) as Promise<Response>,
    register: (input: any) => registerRoute.POST(new Request('https://citybeatmag.co/api/property-management/register', { method: 'POST', headers: { origin: 'https://citybeatmag.co', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })) as Promise<Response>,
  }
}
