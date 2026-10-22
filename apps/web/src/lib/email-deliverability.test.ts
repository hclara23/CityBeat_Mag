import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COLD_SEND_CAP_WITHOUT_BOUNCE_PROCESSING,
  coldSendBudget,
  deliverabilityState,
} from './email-deliverability'

// The failure this prevents: raising citybeat-ghost-reports from monthly to
// weekly while /api/webhooks/resend is returning 503 for every bounce and spam
// complaint, so dead addresses are never suppressed and get mailed again next
// cycle. The damage would land on the domain that also sends receipts, claim
// approvals and lead notifications.

test('a missing webhook secret means bounces are not being processed', () => {
  const state = deliverabilityState({})
  assert.equal(state.bounceProcessing, false)
  assert.match(state.reasons.join(' '), /RESEND_WEBHOOK_SECRET/)
  assert.match(state.reasons.join(' '), /suppression list/)
})

test('whitespace is not a configured secret', () => {
  // A variable set to an empty string or a stray space reads as configured to a
  // naive truthiness check, and the webhook would still 503.
  assert.equal(deliverabilityState({ RESEND_WEBHOOK_SECRET: '' }).bounceProcessing, false)
  assert.equal(deliverabilityState({ RESEND_WEBHOOK_SECRET: '   ' }).bounceProcessing, false)
})

test('a configured secret clears the interlock', () => {
  const state = deliverabilityState({ RESEND_WEBHOOK_SECRET: 'whsec_example' })
  assert.equal(state.bounceProcessing, true)
  assert.deepEqual(state.reasons, [])
})

test('no secret VALUE is ever echoed into the reasons', () => {
  // These reasons are logged and emailed to the operator. An alert that quotes
  // the signing secret is how a secret ends up in a mailbox and a log sink.
  const state = deliverabilityState({ RESEND_WEBHOOK_SECRET: '' })
  const joined = state.reasons.join(' ')
  assert.doesNotMatch(joined, /whsec_/)
})

test('cold volume is held at the cap while bounces are dropped', () => {
  const down = { bounceProcessing: false, reasons: ['bounce webhook down'] }
  const budget = coldSendBudget(200, down)
  assert.equal(budget.allowed, COLD_SEND_CAP_WITHOUT_BOUNCE_PROCESSING)
  assert.equal(budget.capped, true)
  assert.match(budget.why, /bounce processing is down/)
})

test('the interlock is a ceiling on growth, not a cut to what already runs', () => {
  // The existing cadence sends 25 a run and is not the problem. Reducing it
  // would punish a working tactic for a fault elsewhere.
  const down = { bounceProcessing: false, reasons: ['x'] }
  assert.equal(coldSendBudget(25, down).allowed, 25)
  assert.equal(coldSendBudget(25, down).capped, false)
  assert.equal(coldSendBudget(10, down).allowed, 10)
  assert.equal(coldSendBudget(10, down).capped, false)
})

test('a healthy sender gets exactly what it asked for', () => {
  const ok = { bounceProcessing: true, reasons: [] }
  assert.equal(coldSendBudget(500, ok).allowed, 500)
  assert.equal(coldSendBudget(500, ok).capped, false)
  assert.equal(coldSendBudget(500, ok).why, '')
})

test('the budget never invents volume the caller did not ask for', () => {
  // A cap must not become a floor: asking for 3 must never send 25.
  for (const requested of [0, 1, 3, 24]) {
    const down = { bounceProcessing: false, reasons: ['x'] }
    assert.equal(coldSendBudget(requested, down).allowed, requested)
  }
})

test('a negative or fractional request is normalized, not trusted', () => {
  const down = { bounceProcessing: false, reasons: ['x'] }
  assert.equal(coldSendBudget(-5, down).allowed, 0)
  assert.equal(coldSendBudget(7.9, down).allowed, 7)
})

test('the cap is set at the existing run size, so it blocks growth only', () => {
  assert.equal(COLD_SEND_CAP_WITHOUT_BOUNCE_PROCESSING, 25, 'the current ghost-reports default')
})
