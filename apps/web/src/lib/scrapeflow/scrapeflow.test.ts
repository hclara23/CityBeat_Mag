import assert from 'node:assert/strict'
import test from 'node:test'
import { parseJsonLoose, resolveInputs, validateDefinition } from './definition'
import { absolutizeLinks, htmlToText } from './browser'
import {
  formatAddress,
  inRegion,
  listingKey,
  looksLikeSameBusiness,
  mapCategory,
  normalizePhone,
  normalizeWebsite,
  toCandidate,
} from './normalize'
import { WORKFLOW_TEMPLATES } from './templates'
import { TaskType } from './types'

test('every bundled template validates', () => {
  for (const tpl of WORKFLOW_TEMPLATES) {
    const res = validateDefinition(tpl.definition)
    assert.equal(res.ok, true, `${tpl.key}: ${(res as any).error || ''}`)
  }
})

test('validateDefinition rejects bad shapes', () => {
  assert.equal(validateDefinition(null).ok, false)
  assert.equal(validateDefinition({ nodes: [] }).ok, false)
  assert.equal(validateDefinition({ nodes: [{ id: 'a', type: 'PAGE_TO_HTML', inputs: {} }] }).ok, false, 'must start with LAUNCH_BROWSER')
  assert.equal(
    validateDefinition({
      nodes: [
        { id: 'a', type: 'LAUNCH_BROWSER', inputs: { 'Website URL': 'https://x.org' } },
        { id: 'a', type: 'PAGE_TO_HTML', inputs: {} },
      ],
    }).ok,
    false,
    'duplicate ids'
  )
  assert.equal(
    validateDefinition({
      nodes: [
        { id: 'a', type: 'LAUNCH_BROWSER', inputs: { 'Website URL': 'https://x.org' } },
        { id: 'b', type: 'EXTRACT_TEXT_FROM_ELEMENT', inputs: { Selector: '.x' } },
      ],
    }).ok,
    false,
    'HTML input has no producer'
  )
  const ok = validateDefinition({
    nodes: [
      { id: 'a', type: 'LAUNCH_BROWSER', inputs: { 'Website URL': 'https://x.org' } },
      { id: 'b', type: 'PAGE_TO_HTML', inputs: {} },
      { id: 'c', type: 'EXTRACT_TEXT_FROM_ELEMENT', inputs: { Selector: '.x' } },
    ],
  })
  assert.equal(ok.ok, true)
})

test('resolveInputs resolves explicit refs, implicit same-name wiring and defaults', () => {
  const outputs = { launch: { 'Web page': 'https://x.org' }, html: { HTML: '<p>hi</p>', 'Web page': 'https://x.org/2' } }
  const order = ['launch', 'html']
  const explicit = resolveInputs({ id: 'l', type: TaskType.EXTRACT_LINKS, inputs: { HTML: '{{html.HTML}}', Match: '/m/' } }, outputs, order)
  assert.equal(explicit.HTML, '<p>hi</p>')
  assert.equal(explicit.Match, '/m/')
  assert.equal(explicit.Selector, 'a[href]', 'default applied')
  assert.equal(explicit.Max, '10')
  const implicit = resolveInputs({ id: 't', type: TaskType.EXTRACT_TEXT_FROM_ELEMENT, inputs: { Selector: 'h1' } }, outputs, order)
  assert.equal(implicit.HTML, '<p>hi</p>', 'latest same-name output wired in')
  const missing = resolveInputs({ id: 'x', type: TaskType.EXTRACT_LINKS, inputs: { HTML: '{{nope.HTML}}' } }, outputs, order)
  assert.equal(missing.HTML, '<p>hi</p>', 'unresolvable ref falls back to implicit wiring')
})

test('htmlToText strips chrome and surfaces tel/mailto', () => {
  const html = `<html><head><title>T</title><script>x()</script></head><body><nav>Menu</nav>
  <div class="card"><h3>Acme Law</h3><p>123 Main St<br>El Paso, TX 79901</p><a href="tel:9155551234">Call</a> <a href="mailto:hi@acme.com">Email</a></div>
  <footer>foot</footer></body></html>`
  const text = htmlToText(html)
  assert.ok(text.includes('Acme Law'))
  assert.ok(text.includes('[tel:9155551234]'))
  assert.ok(text.includes('[mailto:hi@acme.com]'))
  assert.ok(!text.includes('Menu'))
  assert.ok(!text.includes('x()'))
})

test('absolutizeLinks resolves relative hrefs, dedupes, and filters', () => {
  const html = `<a href="/list/member/a-1">A</a><a href="/list/member/a-1">A again</a><a href="https://other.org/x">O</a><a href="#top">T</a><a href="mailto:a@b.c">M</a>`
  const all = absolutizeLinks(html, 'https://dir.org/list')
  assert.deepEqual(all, ['https://dir.org/list/member/a-1', 'https://other.org/x'])
  const filtered = absolutizeLinks(html, 'https://dir.org/list', 'a[href]', /\/list\/member\//)
  assert.deepEqual(filtered, ['https://dir.org/list/member/a-1'])
})

test('parseJsonLoose tolerates fences and prose', () => {
  assert.deepEqual(parseJsonLoose('```json\n[{"a":1}]\n```'), [{ a: 1 }])
  assert.deepEqual(parseJsonLoose('Here you go: {"a":1} hope that helps'), { a: 1 })
  assert.throws(() => parseJsonLoose('nothing here'))
})

test('directory sink normalizers', () => {
  assert.equal(normalizePhone('915.566.4066'), '(915) 566-4066')
  assert.equal(normalizePhone('1 (915) 555-1234'), '(915) 555-1234')
  assert.equal(normalizePhone(null), null)
  assert.equal(normalizeWebsite('acme.com'), 'https://acme.com')
  assert.equal(normalizeWebsite('https://dir.org/member/acme', 'https://www.dir.org/list'), null, 'never link back to the source directory')
  assert.equal(normalizeWebsite('n/a'), null)
  assert.equal(mapCategory('Law Firm', 'Retail'), 'Attorneys')
  assert.equal(mapCategory('Attorneys', 'Retail'), 'Attorneys')
  assert.equal(mapCategory('Something odd', 'Retail'), 'Retail')
  assert.equal(mapCategory(null, 'Not A Category'), 'Professional Services')
  assert.equal(inRegion({ address: '123 Main', city: 'El Paso', state: 'TX', zip: null }), true)
  assert.equal(inRegion({ address: '5 Rd, Las Cruces NM 88001', city: null, state: null, zip: null }), true)
  assert.equal(inRegion({ address: '1 Way', city: 'Austin', state: 'TX', zip: '78701' }), false)
  assert.equal(inRegion({ address: null, city: null, state: null, zip: '79912' }), true)
  assert.equal(inRegion({ address: null, city: null, state: null, zip: null, phone: '(915) 208-4041' }), true, '915 phone-only entry is local')
  assert.equal(inRegion({ address: '1 Way, Austin, TX 78701', city: null, state: null, zip: null, phone: '(915) 208-4041' }), false, 'out-of-area address wins over local phone')
  assert.equal(inRegion({ address: null, city: null, state: null, zip: null, phone: '(212) 555-0100' }), false)
  assert.equal(formatAddress({ name: 'x', address: '123 Main St', city: 'El Paso', state: 'tx', zip: '79901' }), '123 Main St, El Paso, TX 79901')
  assert.equal(formatAddress({ name: 'x', address: '123 Main St, El Paso, TX 79901', city: 'El Paso', state: 'TX', zip: '79901' }), '123 Main St, El Paso, TX 79901')
})

test('toCandidate produces stable sf: ids and dedupe keys', () => {
  const a = toCandidate({ name: 'Acme Law', address: '123 Main St', city: 'El Paso', state: 'TX', phone: '915-555-1234', website: 'acme.com' }, { defaultCategory: 'Attorneys', sourceUrl: 'https://dir.org' })!
  const b = toCandidate({ name: 'ACME  law', address: '123 Main Street', city: 'El Paso', state: 'TX' }, { defaultCategory: 'Attorneys', sourceUrl: 'https://dir.org' })!
  assert.ok(a.google_place_id.startsWith('sf:'))
  assert.equal(a.google_place_id, b.google_place_id, 'same name + same street number → same id')
  assert.equal(a.phone, '(915) 555-1234')
  assert.equal(a.website, 'https://acme.com')
  assert.equal(a.source, 'scrapeflow')
  assert.equal(listingKey('Acme Law', null, '(915) 555-1234'), 'acme law|9155551234')
  assert.equal(toCandidate({ name: ' ' }, { defaultCategory: 'Retail', sourceUrl: null }), null)
})

test('looksLikeSameBusiness compares phone, then street number', () => {
  assert.equal(looksLikeSameBusiness({ address: '1 A St', phone: '(915) 555-1234' }, { address: '9 B St', phone: '915.555.1234' }), true)
  assert.equal(looksLikeSameBusiness({ address: '123 Main St', phone: null }, { address: '123 Main Street, El Paso', phone: null }), true)
  assert.equal(looksLikeSameBusiness({ address: '123 Main St', phone: null }, { address: '456 Main St', phone: null }), false)
  assert.equal(looksLikeSameBusiness({ address: null, phone: null }, { address: null, phone: '915' }), true)
})
