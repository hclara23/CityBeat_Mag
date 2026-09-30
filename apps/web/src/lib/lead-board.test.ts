import { test } from 'node:test'
import assert from 'node:assert/strict'
import { boardLeads } from './lead-board'

const SENT = '2026-09-26T15:00:00.000Z'
const at = (min: number) => new Date(Date.parse(SENT) + min * 60_000).toISOString()
const row = (over: Record<string, any>) => ({ id: Math.random().toString(36).slice(2), collection: 'sales_outreach', last_sent_at: SENT, scanner_opens: 0, ...over })

test('known-bad contacts and unsubscribes never appear, and are counted', () => {
  const { rows, summary } = boardLeads([
    // "Rockhouse Bar & Grill" — web agency address, later marked bad_contact.
    row({ business_name: 'Rockhouse Bar & Grill', email: 'clients@townsquareinteractive.com', clicks: 2, last_click_at: at(15), status: 'bad_contact' }),
    row({ business_name: 'X', email: 'x@x.com', opens: 2, last_open_at: at(300), status: 'unsubscribed' }),
  ])
  assert.equal(rows.length, 0)
  assert.equal(summary.hidden.bad_contact, 1)
  assert.equal(summary.hidden.unsubscribed, 1)
})

test('an inbox + business shown twice keeps only its strongest row', () => {
  // "Barrio" appeared twice: the merged duplicate listing and the canonical one.
  const { rows, summary } = boardLeads([
    row({ business_name: 'Barrio', email: 'barrioeatsanddrinks@gmail.com', opens: 4, last_open_at: at(200) }),
    row({ business_name: 'Barrio', email: 'BarrioEatsAndDrinks@gmail.com', opens: 4, last_open_at: at(260) }),
  ])
  assert.equal(rows.length, 1)
  assert.equal(summary.hidden.duplicate, 1)
})

test('opens only in the first hour are unconfirmed, not warm', () => {
  // "Mariachi" / "Urban Gyros": opened ~10 minutes after the 09:00 send.
  const { rows, summary } = boardLeads([row({ business_name: 'Mariachi', email: 'm@yahoo.com', opens: 4, last_open_at: at(11) })])
  assert.equal(rows.length, 0)
  assert.equal(summary.hidden.unconfirmed, 1)
})

test('scanner-only rows are counted as scanner', () => {
  const { summary } = boardLeads([row({ business_name: 'Pool', email: 'p@city.gov', scanner_clicks: 2, scanner_opens: 1 })])
  assert.equal(summary.hidden.scanner, 1)
})

test('a rep can mark a lead Not real', () => {
  const { rows, summary } = boardLeads([row({ business_name: 'The District', email: 'a@gmail.com', opens: 2, last_open_at: at(120), lead_dismissed_at: at(500) })])
  assert.equal(rows.length, 0)
  assert.equal(summary.hidden.dismissed, 1)
})

test('verified beats hot beats warm, and all three are shown', () => {
  const { rows, summary } = boardLeads([
    row({ business_name: 'Warm Co', email: 'w@w.com', opens: 3, last_open_at: at(400) }),
    row({ business_name: 'Hot Co', email: 'h@h.com', clicks: 1, last_click_at: at(20) }),
    row({ business_name: 'Real Co', email: 'r@r.com', verified_human_at: at(30) }),
  ])
  assert.deepEqual(rows.map((r) => r.heat), ['verified', 'hot', 'warm'])
  assert.equal(summary.verified, 1)
  assert.equal(rows[0].verified, true)
})

test('a row that was never opened is not a lead and is not counted as hidden', () => {
  const { rows, summary } = boardLeads([row({ business_name: 'Quiet', email: 'q@q.com' })])
  assert.equal(rows.length, 0)
  assert.equal(Object.values(summary.hidden).reduce((a, b) => a + b, 0), 0)
})

test('an address on the global suppression list is hidden even if its own row never changed', () => {
  // "Taft-Diaz": unsubscribed via another stream; this outreach row still says 'opened'.
  const docs = [row({ business_name: 'Taft-Diaz', email: 'Info@Stanton-House.com', clicks: 2, last_click_at: at(20), status: 'opened' })]
  assert.equal(boardLeads(docs).rows.length, 1)
  const { rows, summary } = boardLeads(docs, new Set(['info@stanton-house.com']))
  assert.equal(rows.length, 0)
  assert.equal(summary.hidden.unsubscribed, 1)
})
