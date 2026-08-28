import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POINT_VALUES,
  buildLeaderboard,
  levelForPoints,
  levelProgress,
  pointsFor,
} from './points'

test('point values match the awarded amounts', () => {
  assert.equal(pointsFor('review'), 10) // unchanged from the historical +10
  assert.equal(pointsFor('review_photo'), 5)
  assert.equal(pointsFor('business_photo'), 5)
  assert.equal(pointsFor('event_submission'), 3)
  assert.equal(pointsFor('nonsense' as any), 0)
  assert.ok(Object.values(POINT_VALUES).every((v) => v > 0))
})

test('levels match the historical 0/50/100/200 ladder', () => {
  assert.equal(levelForPoints(0).name, 'Bronze')
  assert.equal(levelForPoints(49).level, 1)
  assert.equal(levelForPoints(50).name, 'Silver')
  assert.equal(levelForPoints(100).name, 'Gold')
  assert.equal(levelForPoints(200).name, 'Elite')
  assert.equal(levelForPoints(9999).name, 'Elite')
  // next-threshold
  assert.equal(levelForPoints(10).next, 50)
  assert.equal(levelForPoints(200).next, null)
  // defensive
  assert.equal(levelForPoints(-5).name, 'Bronze')
  assert.equal(levelForPoints(NaN as any).name, 'Bronze')
})

test('progress fills toward the next level and pins at max', () => {
  assert.equal(levelProgress(0), 0)
  assert.equal(levelProgress(25), 50) // halfway from 0 to 50
  assert.equal(levelProgress(50), 0) // just entered Silver
  assert.equal(levelProgress(75), 50) // halfway 50→100
  assert.equal(levelProgress(200), 100) // max
  assert.equal(levelProgress(500), 100)
})

test('leaderboard ranks by points, excludes advertisers and zero-point users', () => {
  const rows = buildLeaderboard([
    { user_id: 'a', name: 'Ana', points: 120 },
    { user_id: 'b', name: 'Beto', points: 120 }, // tie with Ana → shared rank
    { user_id: 'c', name: 'Carlos', points: 40 },
    { user_id: 'd', name: 'Dora', points: 0 }, // zero → excluded
    { user_id: 'e', name: 'Advertiser', points: 999, is_advertiser: true }, // excluded
  ])
  assert.deepEqual(
    rows.map((r) => `${r.rank}:${r.name}:${r.points}`),
    ['1:Ana:120', '1:Beto:120', '3:Carlos:40']
  )
  // Level + badge come through.
  assert.equal(rows[0].level, 3)
  assert.equal(rows[0].badge, '🥇')
  // No advertiser, no zero-point user.
  assert.equal(rows.find((r) => r.name === 'Advertiser'), undefined)
  assert.equal(rows.find((r) => r.name === 'Dora'), undefined)
})

test('leaderboard honors the limit and defaults a missing name', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ user_id: `u${i}`, points: 100 - i }))
  assert.equal(buildLeaderboard(many, 10).length, 10)
  assert.equal(buildLeaderboard([{ user_id: 'x', points: 5 }])[0].name, 'Contributor')
})
