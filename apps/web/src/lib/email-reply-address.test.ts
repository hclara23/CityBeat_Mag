import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicReplyAddress } from './email'

// What this pins down.
//
// The checkout-recovery nudge — the one email whose entire ask is "just reply
// to this email and we will send a fresh link today" — took the address it
// printed from `process.env.ALERT_EMAIL`. That is the OPERATOR's alert
// destination: lib/ops-health.ts parses it as a comma-separated LIST and
// defaults it to a personal gmail address. So the variable had exactly two
// states, both wrong:
//
//   unset (its actual state on the live service) — the sentence naming an
//     address was omitted entirely, and the email asked a local business to
//     reply without saying where;
//   set as documented — a personal inbox, or the literal string
//     "a@x.com, b@y.com", published to every business we contact.
//
// publicReplyAddress exists so the customer-facing address can never be the
// ops address, and so it defaults to the mailbox replies already land in.

test('defaults to the From mailbox, so Reply and "write to …" agree', () => {
  // The live From is `CityBeat <hello@citybeatmag.co>`. The display name must
  // be stripped: the address goes into a sentence and into a Reply-To header.
  assert.equal(
    publicReplyAddress({ from: 'CityBeat <hello@citybeatmag.co>' }),
    'hello@citybeatmag.co'
  )
  assert.equal(publicReplyAddress({ from: 'hello@citybeatmag.co' }), 'hello@citybeatmag.co')
})

test('SALES_REPLY_EMAIL overrides the From when a support mailbox exists', () => {
  assert.equal(
    publicReplyAddress({ replyEmail: 'support@citybeatmag.co', from: 'CityBeat <hello@citybeatmag.co>' }),
    'support@citybeatmag.co'
  )
  assert.equal(
    publicReplyAddress({ replyEmail: 'CityBeat Support <support@citybeatmag.co>' }),
    'support@citybeatmag.co'
  )
})

test('a LIST yields one address, never a comma-separated string', () => {
  // Reachable by habit, not malice: ALERT_EMAIL is documented as a list, so an
  // operator setting SALES_REPLY_EMAIL the same way must not produce
  // "support@…, hello@…" inside an English sentence or a Reply-To header.
  assert.equal(
    publicReplyAddress({ replyEmail: 'support@citybeatmag.co, hello@citybeatmag.co' }),
    'support@citybeatmag.co'
  )
  assert.equal(
    publicReplyAddress({ replyEmail: 'support@citybeatmag.co; hello@citybeatmag.co' }),
    'support@citybeatmag.co'
  )
  assert.equal(
    publicReplyAddress({ replyEmail: 'support@citybeatmag.co hello@citybeatmag.co' }),
    'support@citybeatmag.co'
  )
})

test('never resolves to empty, so the sentence cannot render with no address', () => {
  // The original bug was an EMPTY value silently removing the line. Every
  // degenerate input must still produce a published CityBeat address.
  for (const input of ['', '   ', 'CityBeat Media Group', 'not-an-email', '<>', '@', 'a@b']) {
    const resolved = publicReplyAddress({ replyEmail: input, from: input })
    assert.match(resolved, /^[^@\s]+@[^@\s]+\.[^@\s]+$/, `"${input}" resolved to "${resolved}"`)
    assert.match(resolved, /@citybeatmag\.co$/, `"${input}" must fall back to a CityBeat address`)
  }
})

test('an unparseable override falls through to the From rather than winning', () => {
  assert.equal(
    publicReplyAddress({ replyEmail: 'please-contact-us', from: 'CityBeat <hello@citybeatmag.co>' }),
    'hello@citybeatmag.co'
  )
})

test('the ops alert address can never leak in, however ALERT_EMAIL is set', () => {
  // The guard is structural — publicReplyAddress does not read ALERT_EMAIL at
  // all — so this asserts the structure rather than a value: with ALERT_EMAIL
  // set to something conspicuous and the customer-facing vars absent, the
  // resolved address must still be the published fallback.
  const prior = process.env.ALERT_EMAIL
  const priorReply = process.env.SALES_REPLY_EMAIL
  const priorFrom = process.env.SALES_FROM_EMAIL
  try {
    process.env.ALERT_EMAIL = 'operator-personal@example.com, second-operator@example.com'
    delete process.env.SALES_REPLY_EMAIL
    delete process.env.SALES_FROM_EMAIL
    const resolved = publicReplyAddress()
    assert.doesNotMatch(resolved, /example\.com/, 'the ops destination must never be printed to a customer')
    assert.match(resolved, /@citybeatmag\.co$/)
  } finally {
    if (prior === undefined) delete process.env.ALERT_EMAIL
    else process.env.ALERT_EMAIL = prior
    if (priorReply === undefined) delete process.env.SALES_REPLY_EMAIL
    else process.env.SALES_REPLY_EMAIL = priorReply
    if (priorFrom === undefined) delete process.env.SALES_FROM_EMAIL
    else process.env.SALES_FROM_EMAIL = priorFrom
  }
})

test('the recovery copy names the resolved address verbatim', async () => {
  // Ties the resolver to the sentence a customer actually reads, so a future
  // change to either side cannot silently decouple them.
  const { recoveryEmail } = await import('./checkout-recovery')
  const address = publicReplyAddress({ from: 'CityBeat <hello@citybeatmag.co>' })
  const { html } = recoveryEmail({ businessName: 'Dos Lunas BBQ', productName: 'Premium', replyTo: address })
  assert.ok(html.includes(address), 'the printed address must be the resolved one')
  // And the ask it is answering is still present, in both languages.
  assert.match(recoveryEmail({ replyTo: address }).html, /reply to this email/i)
  assert.match(recoveryEmail({ locale: 'es', replyTo: address }).html, /responde a este correo/i)
})
