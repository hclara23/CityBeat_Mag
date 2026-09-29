import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCANNER_WINDOW_MS, humanSignals, isScannerHit, leadHeat } from './lead-heat'

const SENT = '2026-09-29T15:00:00.000Z'
const at = (min: number) => new Date(Date.parse(SENT) + min * 60_000).toISOString()

test('a hit inside three minutes of the send is a scanner', () => {
  assert.equal(SCANNER_WINDOW_MS, 180_000)
  assert.equal(isScannerHit(SENT, Date.parse(at(0.5))), true)
  assert.equal(isScannerHit(SENT, Date.parse(at(2.9))), true)
  assert.equal(isScannerHit(SENT, Date.parse(at(3))), false)
  assert.equal(isScannerHit(SENT, Date.parse(at(240))), false)
})

test('unknown send time falls back to counting the hit', () => {
  assert.equal(isScannerHit(undefined, Date.now()), false)
})

test('a Firestore timestamp is understood', () => {
  const ts = { toDate: () => new Date(SENT) }
  assert.equal(isScannerHit(ts, Date.parse(at(1))), true)
})

// Shapes taken from real September 2026 rows.
test('the old board called scanner traffic HOT; now it is cold', () => {
  // "Veterans Indoor Pool": 1 open, 1 click, both ~2 min after the 09:00 send.
  assert.equal(leadHeat({ opens: 1, clicks: 1, last_sent_at: SENT, last_open_at: at(2), last_click_at: at(2.1) }), 'cold')
})

test('a person re-opening days later is warm', () => {
  // "Twisted Fork": 4 opens, last one 11 days after sending.
  assert.equal(leadHeat({ opens: 4, clicks: 0, last_sent_at: SENT, last_open_at: at(16251) }), 'warm')
})

test('a late click is hot even if the open was a scanner', () => {
  assert.equal(leadHeat({ opens: 1, clicks: 2, last_sent_at: SENT, last_open_at: at(1), last_click_at: at(15) }), 'hot')
})

test('records from the fixed tracker are taken at face value', () => {
  // The tracker already excluded scanner hits, so a quick human click stands.
  const row = { opens: 1, clicks: 1, scanner_clicks: 3, last_sent_at: SENT, last_click_at: at(1) }
  assert.deepEqual(humanSignals(row), { opens: 1, clicks: 1 })
  assert.equal(leadHeat(row), 'hot')
})

test('nothing at all is cold', () => {
  assert.equal(leadHeat({}), 'cold')
})
