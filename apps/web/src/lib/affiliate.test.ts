import { test } from 'node:test'
import assert from 'node:assert/strict'
import { affiliateTicketUrl, affiliateConfigured } from './affiliate'

// Save/restore the two env vars each test touches so they don't leak.
function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const keys = ['TICKETMASTER_AFFILIATE_WRAP', 'TICKETMASTER_AFFILIATE_PARAMS']
  const saved: Record<string, string | undefined> = {}
  for (const k of keys) saved[k] = process.env[k]
  try {
    for (const k of keys) {
      if (env[k] === undefined) delete process.env[k]
      else process.env[k] = env[k]
    }
    fn()
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
}

test('SECURITY: non-http(s) and malformed hrefs are neutralized to null', () => {
  // A javascript:/data: href would execute in the reader's browser.
  assert.equal(affiliateTicketUrl('javascript:alert(1)'), null)
  assert.equal(affiliateTicketUrl('data:text/html,<script>1</script>'), null)
  assert.equal(affiliateTicketUrl('not a url'), null)
  assert.equal(affiliateTicketUrl('ftp://ticketmaster.com/x'), null)
})

test('null/undefined pass through as null, never a string', () => {
  assert.equal(affiliateTicketUrl(null), null)
  assert.equal(affiliateTicketUrl(undefined), null)
})

test('non-Ticketmaster URLs are returned unchanged (never tagged)', () => {
  withEnv({ TICKETMASTER_AFFILIATE_WRAP: 'https://x.evyy.net/c/?u={url}', TICKETMASTER_AFFILIATE_PARAMS: undefined }, () => {
    const u = 'https://eventbrite.com/e/123'
    assert.equal(affiliateTicketUrl(u), u)
    // A community event site is never rewritten even with a wrap configured.
    assert.equal(affiliateTicketUrl('https://example.com/tickets'), 'https://example.com/tickets')
  })
})

test('Ticketmaster URL with no affiliate config is returned unchanged', () => {
  withEnv({ TICKETMASTER_AFFILIATE_WRAP: undefined, TICKETMASTER_AFFILIATE_PARAMS: undefined }, () => {
    const u = 'https://www.ticketmaster.com/event/abc'
    assert.equal(affiliateTicketUrl(u), u)
    assert.equal(affiliateConfigured(), false)
  })
})

test('WRAP format URL-encodes the destination into {url}', () => {
  withEnv({ TICKETMASTER_AFFILIATE_WRAP: 'https://ticketmaster.evyy.net/c/PUB/CAMP/API?u={url}', TICKETMASTER_AFFILIATE_PARAMS: undefined }, () => {
    const u = 'https://www.ticketmaster.com/event/abc?x=1'
    assert.equal(
      affiliateTicketUrl(u),
      `https://ticketmaster.evyy.net/c/PUB/CAMP/API?u=${encodeURIComponent(u)}`
    )
    assert.equal(affiliateConfigured(), true)
  })
})

test('PARAMS format appends with the correct ?/& join and strips leading ?/&', () => {
  withEnv({ TICKETMASTER_AFFILIATE_WRAP: undefined, TICKETMASTER_AFFILIATE_PARAMS: '?irgwc=1&clickid=xyz' }, () => {
    // Destination already has a query → append with &
    assert.equal(
      affiliateTicketUrl('https://www.livenation.com/e?a=1'),
      'https://www.livenation.com/e?a=1&irgwc=1&clickid=xyz'
    )
    // Destination has no query → append with ?
    assert.equal(
      affiliateTicketUrl('https://www.ticketweb.com/e'),
      'https://www.ticketweb.com/e?irgwc=1&clickid=xyz'
    )
  })
})
