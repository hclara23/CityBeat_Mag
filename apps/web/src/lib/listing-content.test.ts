import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_POSTS,
  MAX_SERVICES,
  activePosts,
  attributeLabel,
  elPasoDayKey,
  postStatus,
  sanitizeActionLinks,
  sanitizeAttributes,
  sanitizeHoursRecord,
  sanitizeHttpUrl,
  sanitizePosts,
  sanitizeProducts,
  sanitizeServices,
  sanitizeSocialLinks,
  sanitizeSpecialHours,
} from './listing-content'

const NOW = Date.parse('2026-07-31T12:00:00.000Z')
const TODAY = '2026-07-31'

test('services are trimmed, capped, and require a name', () => {
  const out = sanitizeServices([
    { name: '  Haircut  ', name_es: 'Corte', price_label: '$25', description: 'Classic cut' },
    { name: '', price_label: '$99' }, // no name → dropped
    'garbage',
    null,
    { name: 'x'.repeat(500) },
  ])
  assert.equal(out.length, 2)
  assert.equal(out[0].name, 'Haircut')
  assert.equal(out[0].name_es, 'Corte')
  assert.equal(out[1].name.length, 120)
  // Cap
  const many = sanitizeServices(Array.from({ length: 100 }, (_, i) => ({ name: `S${i}` })))
  assert.equal(many.length, MAX_SERVICES)
})

test('products share the service shape with their own cap', () => {
  const out = sanitizeProducts([{ name: 'Tacos al pastor', price_label: '$3' }])
  assert.equal(out[0].name, 'Tacos al pastor')
  assert.equal(out[0].id, 'prod-0')
})

test('item ids are preserved when safe and regenerated when not', () => {
  const out = sanitizeServices([
    { id: 'svc-abc_123', name: 'Keep' },
    { id: '<script>', name: 'Regen' },
  ])
  assert.equal(out[0].id, 'svc-abc_123')
  assert.equal(out[1].id, 'svc-1')
})

test('URLs must be http(s) and bounded', () => {
  assert.equal(sanitizeHttpUrl('https://book.example/x'), 'https://book.example/x')
  assert.equal(sanitizeHttpUrl('http://ok.example'), 'http://ok.example/')
  assert.equal(sanitizeHttpUrl('javascript:alert(1)'), null)
  assert.equal(sanitizeHttpUrl('ftp://files.example'), null)
  assert.equal(sanitizeHttpUrl('not a url'), null)
  assert.equal(sanitizeHttpUrl('https://' + 'a'.repeat(400) + '.com'), null)
})

test('action links keep only known keys with valid URLs', () => {
  const out = sanitizeActionLinks({
    booking: 'https://book.example',
    order: 'javascript:alert(1)',
    hack: 'https://evil.example',
    quote: 'https://quote.example',
  })
  assert.deepEqual(Object.keys(out).sort(), ['booking', 'quote'])
})

test('attributes are allow-listed and deduped', () => {
  const out = sanitizeAttributes(['free_wifi', 'free_wifi', 'made_up_attr', 'delivery', 42])
  assert.deepEqual(out, ['free_wifi', 'delivery'])
  assert.equal(attributeLabel('free_wifi', 'es'), 'Wi-Fi gratis')
  assert.equal(attributeLabel('free_wifi', 'en'), 'Free Wi-Fi')
})

test('posts validate type, dates, and CTA and are capped', () => {
  const out = sanitizePosts(
    [
      { title: 'Grand opening', type: 'event', starts_at: '2026-08-01', ends_at: '2026-08-02', cta_url: 'https://x.example' },
      { title: 'Deal', type: 'offer', ends_at: 'not-a-date', cta_url: 'javascript:x' },
      { title: '', type: 'update' }, // no title → dropped
      { title: 'Plain', type: 'bogus' },
    ],
    new Date(NOW)
  )
  assert.equal(out.length, 3)
  assert.equal(out[0].type, 'event')
  assert.equal(out[0].starts_at, '2026-08-01')
  assert.equal(out[1].ends_at, null)
  assert.equal(out[1].cta_url, null)
  assert.equal(out[2].type, 'update')
  assert.ok(out.every((p) => p.created_at))
  const many = sanitizePosts(Array.from({ length: 50 }, (_, i) => ({ title: `P${i}` })), new Date(NOW))
  assert.equal(many.length, MAX_POSTS)
})

test('post scheduling uses local calendar days: active through the whole end day', () => {
  const post = { starts_at: '2026-08-01', ends_at: '2026-08-03' }
  assert.equal(postStatus(post, '2026-07-31'), 'scheduled')
  assert.equal(postStatus(post, '2026-08-01'), 'active')
  assert.equal(postStatus(post, '2026-08-03'), 'active') // through the whole end day
  assert.equal(postStatus(post, '2026-08-04'), 'expired')
  assert.equal(postStatus({ starts_at: null, ends_at: null }, TODAY), 'active')
})

test('elPasoDayKey returns the local business calendar day (DST-aware)', () => {
  // 01:00 UTC on Aug 1 is still Jul 31 in America/Denver (UTC-6 in summer).
  assert.equal(elPasoDayKey(new Date('2026-08-01T01:00:00Z')), '2026-07-31')
  assert.equal(elPasoDayKey(new Date('2026-08-01T18:00:00Z')), '2026-08-01')
})

test('activePosts filters to currently-active, newest first', () => {
  const posts = sanitizePosts(
    [
      { title: 'Old', created_at: '2026-07-01T00:00:00Z' },
      { title: 'Scheduled', starts_at: '2026-09-01', created_at: '2026-07-20T00:00:00Z' },
      { title: 'Expired', ends_at: '2026-07-01', created_at: '2026-07-02T00:00:00Z' },
      { title: 'New', created_at: '2026-07-30T00:00:00Z' },
    ],
    new Date(NOW)
  )
  const act = activePosts(posts, TODAY)
  assert.deepEqual(act.map((p) => p.title), ['New', 'Old'])
  assert.deepEqual(activePosts(null, TODAY), [])
})

test('social links keep only valid http(s) urls', () => {
  assert.deepEqual(
    sanitizeSocialLinks({ facebook: 'https://fb.com/x', instagram: 'javascript:alert(1)', twitter: '', bogus: 'https://y' }),
    { facebook: 'https://fb.com/x' }
  )
})

test('hours record drops unknown keys and caps values', () => {
  const out = sanitizeHoursRecord({ Monday: '9-5', Funday: 'x', Tuesday: 'y'.repeat(200) })
  assert.equal(out.Monday, '9-5')
  assert.equal('Funday' in out, false)
  assert.equal(out.Tuesday.length, 60)
})

test('special hours require a valid date + label, dedupe by date, and sort', () => {
  const out = sanitizeSpecialHours([
    { date: '2026-12-25', hours: 'Closed' },
    { date: '2026-11-26', hours: '9 AM - 1 PM' },
    { date: '2026-12-25', hours: 'Duplicate' },
    { date: 'nope', hours: 'x' },
    { date: '2026-01-01', hours: '' },
  ])
  assert.deepEqual(out, [
    { date: '2026-11-26', hours: '9 AM - 1 PM' },
    { date: '2026-12-25', hours: 'Closed' },
  ])
})
