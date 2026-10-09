import { test } from 'node:test'
import assert from 'node:assert/strict'
import { socialShareLinks } from './share-links'

test('social links preserve the complete public article URL and title', () => {
  const url = 'https://citybeatmag.co/en/stories/premier-clinic-cover-story'
  const title = 'Premier: “I’m Not a Number” & El Paso'
  const links = socialShareLinks(url, title)
  assert.deepEqual(links.map(l=>l.label), ['Facebook','X','LinkedIn','WhatsApp'])
  for(const link of links) {
    const target = new URL(link.href)
    assert.equal(target.protocol, 'https:')
    if(link.name === 'whatsapp') assert.equal(target.searchParams.get('text'), `${title} ${url}`)
    else assert.equal(target.searchParams.get(link.name === 'facebook' ? 'u' : 'url'), url)
    if(link.name === 'x') assert.equal(target.searchParams.get('text'), title)
  }
})
