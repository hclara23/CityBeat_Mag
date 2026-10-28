import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SPANISH_SHARE,
  outreachLocale,
  outreachPriority,
  planNewContacts,
  subjectVariant,
} from './sales-agent'

const none = { listingIds: new Set<string>(), emails: new Set<string>() }
const listing = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Biz ${id}`,
  category: 'Beauty',
  email: `${id}@${id}.com`,
  claim_status: 'unclaimed',
  is_published: true,
  ...extra,
})

test('categories that matched a paying customer or the best B2B click rate go first; restaurants and cafes go last; nobody is excluded', () => {
  assert.equal(outreachPriority('Auto Repair'), 0)
  assert.equal(outreachPriority('home services'), 0)
  assert.equal(outreachPriority('Automation & Controls'), 0)
  assert.equal(outreachPriority('Beauty'), 1)
  assert.equal(outreachPriority(undefined), 1)
  assert.equal(outreachPriority('Restaurant'), 2)
  assert.equal(outreachPriority(' Cafe '), 2)

  const plan = planNewContacts(
    [listing('a', { category: 'Restaurant' }), listing('b', { category: 'Beauty' }), listing('c', { category: 'Auto Repair' })],
    none
  )
  assert.deepEqual(plan.ordered.map((l) => l.id), ['c', 'b', 'a'], 'priority first, a restaurant is still contacted')
})

test('a hidden, folded-in, held or already-claimed listing is never pitched as "listed in the directory"', () => {
  const plan = planNewContacts(
    [
      listing('ok'),
      listing('unpub', { is_published: false }),
      listing('merged', { merged_into: 'ok' }),
      listing('held', { publication_hold: 'fmcsa_individual' }),
      listing('claimed', { claim_status: 'approved' }),
      listing('nopublishflag', { is_published: undefined }),
    ],
    none
  )
  assert.deepEqual(plan.ordered.map((l) => l.id), ['ok'])
  assert.equal(plan.skipped.unpublished, 2)
  assert.equal(plan.skipped.merged, 1)
  assert.equal(plan.skipped.held, 1)
  assert.equal(plan.skipped.not_unclaimed, 1)
})

test('one pitch per inbox: a branch sharing an address, or an inbox already mailed via another listing, is skipped', () => {
  const plan = planNewContacts(
    [
      listing('x1', { email: 'owner@chain.com', category: 'Beauty' }),
      listing('x2', { email: 'Owner@Chain.com ', category: 'Auto Repair' }),
      listing('y', { email: 'seen@before.com' }),
      listing('z', { email: 'fresh@z.com' }),
      listing('w'),
    ],
    { listingIds: new Set(['w']), emails: new Set(['seen@before.com']) }
  )
  // x2 outranks x1 on category, so it keeps the inbox; x1 is the duplicate.
  assert.deepEqual(plan.ordered.map((l) => l.id), ['x2', 'z'])
  assert.equal(plan.skipped.duplicate_inbox, 1)
  assert.equal(plan.skipped.already_contacted, 2)
})

test('head-office and web-agency inboxes are filtered at send time, not only when they are scraped', () => {
  const plan = planNewContacts(
    [
      listing('own', { email: 'hi@joessalon.com', website: 'https://www.joessalon.com' }),
      listing('agency', { email: 'clients@townsquareinteractive.com', website: 'https://joesbarber.com' }),
      listing('gmail', { email: 'joe@gmail.com', website: 'https://joesplumbing.com' }),
      listing('nosite', { email: 'a@b.com' }),
      listing('locator', { email: 'help@wingstop.com', website: 'https://www.wingstop.com/location/el-paso' }),
      listing('bad', { email: 'not-an-email' }),
    ],
    none
  )
  assert.deepEqual(plan.ordered.map((l) => l.id).sort(), ['gmail', 'nosite', 'own'])
  assert.equal(plan.skipped.foreign_inbox, 1)
  assert.equal(plan.skipped.chain_locator, 1)
  assert.equal(plan.skipped.invalid_email, 1)
})

test('every excluded listing is counted, so a short queue explains itself', () => {
  const pool = [listing('a'), listing('b', { is_published: false }), listing('c', { merged_into: 'a' })]
  const plan = planNewContacts(pool, none)
  const skippedTotal = Object.values(plan.skipped).reduce((n, v) => n + v, 0)
  assert.equal(plan.ordered.length + skippedTotal, pool.length)
})

test('language is deterministic per listing and honours the share at both ends', () => {
  assert.equal(outreachLocale('sf:abc', 0.5), outreachLocale('sf:abc', 0.5))
  for (const id of ['a', 'b', 'c', 'sf:1']) {
    assert.equal(outreachLocale(id, 0), 'en', 'spanish=0 is the English-only switch')
    assert.equal(outreachLocale(id, 1), 'es')
    assert.equal(outreachLocale(id, -3), 'en')
    assert.equal(outreachLocale(id, Number.NaN), 'en', 'a garbage share fails to English, never to a surprise language')
  }
  assert.equal(DEFAULT_SPANISH_SHARE, 0.5)
})

test('the language split is near the requested share and independent of the subject-line arm', () => {
  const ids = Array.from({ length: 5000 }, (_, i) => `sf:${(i * 2654435761 >>> 0).toString(16)}${i}`)
  const es = ids.filter((id) => outreachLocale(id, 0.5) === 'es').length
  assert.ok(es > 2300 && es < 2700, `expected ~50% Spanish, got ${es}/5000`)

  // Within every subject arm both languages must appear in similar proportion,
  // or a comparison of Spanish vs English would really be a comparison of arms.
  for (let arm = 0; arm < 5; arm++) {
    const inArm = ids.filter((id) => subjectVariant(id) === arm)
    const share = inArm.filter((id) => outreachLocale(id, 0.5) === 'es').length / inArm.length
    assert.ok(share > 0.4 && share < 0.6, `arm ${arm}: Spanish share ${share.toFixed(2)} should stay near 0.5`)
  }

  const quarter = ids.filter((id) => outreachLocale(id, 0.25) === 'es').length
  assert.ok(quarter > 1100 && quarter < 1400, `expected ~25% Spanish, got ${quarter}/5000`)
})
