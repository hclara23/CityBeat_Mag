import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  newsletterSlotConflict,
  newsletterSlotConflictMessage,
  newsletterSlotLabel,
  pickNewsletterSponsor,
} from './newsletter-slot'

// The failure these pin: two businesses are both paying for the ONE newsletter
// sponsor slot, the digest renders whichever one Firestore happened to return
// first, and the other one is billed for a placement nobody ever saw. Nothing
// crashes, nothing 500s — the only symptom is a customer who eventually notices.

const active = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  placement: 'newsletter',
  is_active: true,
  ...extra,
})

test('two live sponsors resolve to the older one, and the newcomer is reported', () => {
  const { sponsor, conflictIds } = pickNewsletterSponsor([
    active('newcomer', { created_at: '2026-08-01T00:00:00.000Z', sponsor_name: 'Late Co' }),
    active('incumbent', { created_at: '2026-05-01T00:00:00.000Z', sponsor_name: 'First Co' }),
  ])
  assert.equal(sponsor?.id, 'incumbent')
  // Silently promoting the newcomer over a customer who has been paying longer
  // is the one outcome that must never happen by accident.
  assert.deepEqual(conflictIds, ['newcomer'])
})

test('a doc with no created_at is ordered by updated_at, not dropped into unspecified order', () => {
  // admin/campaigns mirrors an approved sponsorship to ad_banners/campaign:<id>
  // with updated_at and NO created_at. Comparing undefined numerically yields
  // NaN, every NaN comparison is false, and the sort result then depends on the
  // input order — the exact nondeterminism this module removes.
  const docs = [
    active('banner', { created_at: '2026-06-10T00:00:00.000Z' }),
    active('campaign:abc', { updated_at: '2026-02-01T00:00:00.000Z' }),
  ]
  assert.equal(pickNewsletterSponsor(docs).sponsor?.id, 'campaign:abc')
  assert.deepEqual(pickNewsletterSponsor(docs).conflictIds, ['banner'])
  // Reversing the input must not reverse the answer.
  assert.equal(pickNewsletterSponsor([...docs].reverse()).sponsor?.id, 'campaign:abc')
})

test('a doc with no usable timestamp at all still sorts, and never wins over a dated one', () => {
  // A hand-edited row, or a legacy doc written before either stamp existed. It
  // cannot demonstrate that it is the incumbent, so it must not displace one —
  // and it must still land in a fixed position instead of a random one.
  const dated = active('dated', { created_at: '2026-07-04T00:00:00.000Z' })
  const undatedB = active('b-undated')
  const undatedA = active('a-undated')
  const result = pickNewsletterSponsor([undatedB, dated, undatedA])
  assert.equal(result.sponsor?.id, 'dated')
  assert.deepEqual(result.conflictIds, ['a-undated', 'b-undated'])
})

test('an unparseable timestamp is treated as absent rather than poisoning the order', () => {
  const result = pickNewsletterSponsor([
    active('garbage', { created_at: 'not a date' }),
    active('real', { created_at: '2026-01-01T00:00:00.000Z' }),
  ])
  assert.equal(result.sponsor?.id, 'real')
  assert.deepEqual(result.conflictIds, ['garbage'])
})

test('Firestore Timestamp objects are ordered by their real instant', () => {
  // Server-timestamped docs read back as Timestamp instances, not strings; if
  // those fell through to "undated" the two write paths would rank differently.
  const stamp = (ms: number) => ({ toMillis: () => ms, toDate: () => new Date(ms) })
  const result = pickNewsletterSponsor([
    active('newer', { created_at: stamp(Date.parse('2026-08-01T00:00:00.000Z')) }),
    active('older', { created_at: stamp(Date.parse('2026-03-01T00:00:00.000Z')) }),
  ])
  assert.equal(result.sponsor?.id, 'older')
})

test('the same set of sponsors picks the same winner no matter what order it arrives in', () => {
  // Firestore gives no ordering guarantee without an orderBy, so consecutive
  // sends can receive these rows in different orders. The rendered sponsor must
  // not change between sends.
  const docs = [
    active('a', { created_at: '2026-04-01T00:00:00.000Z' }),
    active('b', { created_at: '2026-04-01T00:00:00.000Z' }), // identical stamp: id breaks the tie
    active('c', { updated_at: '2026-03-01T00:00:00.000Z' }),
    active('d'),
    active('e', { created_at: '2026-09-01T00:00:00.000Z' }),
  ]
  const expected = pickNewsletterSponsor(docs)
  assert.equal(expected.sponsor?.id, 'c')
  assert.deepEqual(expected.conflictIds, ['a', 'b', 'e', 'd'])

  for (const shuffled of [
    [docs[4], docs[3], docs[2], docs[1], docs[0]],
    [docs[1], docs[0], docs[4], docs[2], docs[3]],
    [docs[3], docs[2], docs[0], docs[4], docs[1]],
    [docs[2], docs[4], docs[1], docs[3], docs[0]],
  ]) {
    const got = pickNewsletterSponsor(shuffled)
    assert.equal(got.sponsor?.id, expected.sponsor?.id)
    assert.deepEqual(got.conflictIds, expected.conflictIds)
  }
})

test('one live sponsor is not reported as conflicting with itself', () => {
  const { sponsor, conflictIds } = pickNewsletterSponsor([
    active('only', { created_at: '2026-06-01T00:00:00.000Z' }),
  ])
  assert.equal(sponsor?.id, 'only')
  assert.deepEqual(conflictIds, [])
})

test('an empty slot yields no sponsor and no alert', () => {
  // The digest renders fine without a sponsor; paging a human here would train
  // them to ignore the channel.
  assert.deepEqual(pickNewsletterSponsor([]), { sponsor: null, conflictIds: [] })
  assert.deepEqual(newsletterSlotConflict([], 'anything'), [])
})

test('inactive banners and other placements never occupy the newsletter slot', () => {
  // These are exactly the rows the production query filters out; the pure
  // function has to agree with it or the two would disagree about who is live.
  const { sponsor, conflictIds } = pickNewsletterSponsor([
    { id: 'paused', placement: 'newsletter', is_active: false, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'sidebar', placement: 'sidebar', is_active: true, created_at: '2026-01-02T00:00:00.000Z' },
    active('live', { created_at: '2026-06-01T00:00:00.000Z' }),
  ])
  assert.equal(sponsor?.id, 'live')
  assert.deepEqual(conflictIds, [])
})

test('editing the banner that already holds the slot does not conflict with itself', () => {
  // Without excludeId, renaming the current sponsor or swapping its creative
  // would 409 — the admin would be locked out of the very row they own.
  const docs = [active('campaign:abc', { updated_at: '2026-02-01T00:00:00.000Z' })]
  assert.deepEqual(newsletterSlotConflict(docs, 'campaign:abc'), [])
  // A DIFFERENT document activating into the same slot still conflicts.
  assert.deepEqual(newsletterSlotConflict(docs, 'banner-2'), ['campaign:abc'])
  // Creating a brand-new banner has no id to exclude.
  assert.deepEqual(newsletterSlotConflict(docs, null), ['campaign:abc'])
  assert.deepEqual(newsletterSlotConflict(docs), ['campaign:abc'])
})

test('the conflict list names the incumbent first, so the refusal points at the right banner', () => {
  const conflicts = newsletterSlotConflict(
    [
      active('newer', { created_at: '2026-08-01T00:00:00.000Z' }),
      active('older', { created_at: '2026-01-01T00:00:00.000Z' }),
    ],
    'a-third-banner'
  )
  assert.deepEqual(conflicts, ['older', 'newer'])
})

test('the occupant is always named by something an admin can act on', () => {
  assert.equal(newsletterSlotLabel({ id: 'x', sponsor_name: 'Sun City Tacos' }), 'Sun City Tacos')
  assert.equal(newsletterSlotLabel({ id: 'x', sponsor_name: '   ', title: 'Fall Campaign' }), 'Fall Campaign')
  // No name and no title still has to identify a document, or the admin cannot
  // find the banner they were told to deactivate.
  assert.equal(newsletterSlotLabel({ id: 'campaign:abc' }), 'campaign:abc')
  assert.match(newsletterSlotConflictMessage('Sun City Tacos'), /Sun City Tacos/)
})
