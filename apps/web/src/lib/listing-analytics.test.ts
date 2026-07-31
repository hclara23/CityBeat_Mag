import assert from 'node:assert/strict'
import test from 'node:test'
import {
  csvCell,
  dayKey,
  daysAgoKey,
  isValidListingEventType,
  percentChange,
  statsDocId,
  statsToCsv,
  summarizeListingStats,
  totalsForRange,
} from './listing-analytics'

const NOW = new Date('2026-07-31T18:00:00.000Z')

test('event types are a strict allow-list', () => {
  assert.equal(isValidListingEventType('view'), true)
  assert.equal(isValidListingEventType('lead'), true)
  assert.equal(isValidListingEventType('click_website'), true)
  assert.equal(isValidListingEventType('drop_table'), false)
  assert.equal(isValidListingEventType(''), false)
  assert.equal(isValidListingEventType(null), false)
})

test('day keys and doc ids are stable', () => {
  assert.equal(dayKey(NOW), '2026-07-31')
  assert.equal(daysAgoKey(NOW, 1), '2026-07-30')
  assert.equal(statsDocId('abc', '2026-07-31'), 'abc_2026-07-31')
})

test('range totals sum only rows inside the window and tolerate junk', () => {
  const rows = [
    { day: '2026-07-30', view: 5, lead: 1 },
    { day: '2026-07-31', view: 3, click_website: 2 },
    { day: '2026-06-01', view: 100 }, // outside
    { day: '2026-07-29', view: Number.NaN as unknown as number },
  ]
  const t = totalsForRange(rows, '2026-07-29', '2026-07-31')
  assert.equal(t.view, 8)
  assert.equal(t.lead, 1)
  assert.equal(t.click_website, 2)
})

test('summary builds a zero-filled series and a prior-window comparison', () => {
  const rows = [
    { day: dayKey(NOW), view: 10, lead: 2, click_website: 1 },
    { day: daysAgoKey(NOW, 5), view: 4 },
    { day: daysAgoKey(NOW, 35), view: 7 }, // in the PREVIOUS window
  ]
  const s = summarizeListingStats(rows, NOW, 30)
  assert.equal(s.window_days, 30)
  assert.equal(s.series.length, 30)
  assert.equal(s.series[29].day, dayKey(NOW))
  assert.equal(s.series[29].view, 10)
  assert.equal(s.series[29].clicks, 1)
  // Quiet days are zero-filled, not skipped.
  assert.equal(s.series[1].view, 0)
  assert.equal(s.current.view, 14)
  assert.equal(s.previous.view, 7)
})

test('percentChange handles zero baselines', () => {
  assert.equal(percentChange(20, 10), 100)
  assert.equal(percentChange(5, 10), -50)
  assert.equal(percentChange(0, 0), 0)
  assert.equal(percentChange(5, 0), null) // new activity, no baseline
})

test('CSV cells neutralize formula injection and escape quotes/commas', () => {
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvCell('+1234'), "'+1234")
  assert.equal(csvCell('@cmd'), "'@cmd")
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('has,comma'), '"has,comma"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
})

test('statsToCsv emits sorted rows with a header', () => {
  const csv = statsToCsv([
    { day: '2026-07-31', view: 3 },
    { day: '2026-07-30', view: 5, lead: 1 },
  ])
  const lines = csv.split('\r\n')
  assert.equal(lines[0], 'day,views,website_clicks,direction_clicks,action_clicks,leads')
  assert.equal(lines[1], '2026-07-30,5,0,0,0,1')
  assert.equal(lines[2], '2026-07-31,3,0,0,0,0')
})
