import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canPublish, isSlot, nextSlot, safeArticleLink, SLOT_GRACE_MS, slotParts } from './social-schedule'

test('daily slots are 6 AM, noon and 6 PM El Paso time', () => {
  const now = Date.parse('2026-10-09T05:00:00Z')
  const slots: Record<string, string> = {}
  const times = []
  for (let i = 0; i < 93; i++) {
    const t = nextSlot(now, slots)
    assert.equal(slots[String(t)], undefined)
    slots[String(t)] = String(i)
    times.push(t)
  }
  assert.deepEqual(times.slice(0, 3).map(t => new Date(t).toISOString()), ['2026-10-09T12:00:00.000Z', '2026-10-09T18:00:00.000Z', '2026-10-10T00:00:00.000Z'])
  assert.equal(new Set(times.map(t => slotParts(t).date)).size, 31)
})
test('spring and fall DST keep local publication hours', () => {
  for (const [now, expected] of [['2026-11-01T06:00:00Z', '2026-11-01T13:00:00.000Z'], ['2027-03-14T07:00:00Z', '2027-03-14T12:00:00.000Z']]) {
    assert.equal(new Date(nextSlot(Date.parse(now), {})).toISOString(), expected)
  }
})
test('lead time and occupied slots prevent immediate or overlapping intake', () => {
  const now = Date.parse('2026-10-09T11:45:00Z')
  assert.equal(new Date(nextSlot(now, {})).toISOString(), '2026-10-09T18:00:00.000Z')
  assert.equal(new Date(nextSlot(now, { [Date.parse('2026-10-09T18:00:00Z')]: 'other' })).toISOString(), '2026-10-10T00:00:00.000Z')
})
test('only reviewed due posts inside their window may publish', () => {
  const t = Date.parse('2026-10-09T12:00:00Z')
  const item = { status: 'scheduled', scheduled_at: t, reviewed_at: t - 3600_000, caption: 'Reviewed caption' }
  assert.equal(canPublish(item, t - 1, false), false)
  assert.equal(canPublish(item, t, false), true)
  assert.equal(canPublish(item, t + SLOT_GRACE_MS, false), false)
  assert.equal(canPublish(item, t, true), false)
  for (const status of ['queued', 'reviewing', 'cancelled', 'paused', 'posted', 'publishing', 'publish_uncertain']) assert.equal(canPublish({ ...item, status }, t, false), false)
  assert.equal(canPublish({ ...item, reviewed_at: undefined }, t, false), false)
  assert.equal(canPublish({ ...item, scheduled_at: t - 1000 }, t, false), false)
  assert.equal(isSlot(NaN), false)
})
test('article links cannot inject arbitrary targets or credentials', () => {
  assert.equal(safeArticleLink('https://citybeatmag.co/en/stories/premier-clinic-cover-story?utm_source=fb'), 'https://citybeatmag.co/en/stories/premier-clinic-cover-story')
  assert.equal(safeArticleLink(null), '')
  for (const value of ['javascript:alert(1)', 'https://evil.test/en/stories/x', 'https://citybeatmag.co@evil.test/en/stories/x', 'https://user:pass@citybeatmag.co/en/stories/x', 'https://citybeatmag.co/api/admin', 3]) assert.throws(() => safeArticleLink(value))
})
