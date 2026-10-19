import test from 'node:test'
import assert from 'node:assert/strict'
import { queueGooglePageView } from './analytics-queue'

test('first page view is queued before Google loads and config is not duplicated', () => {
  const target: Parameters<typeof queueGooglePageView>[0] = {}
  const page = { page_path: '/en', page_location: 'https://citybeatmag.co/en', page_title: 'CityBeat' }
  queueGooglePageView(target, 'G-TEST', page)
  queueGooglePageView(target, 'G-TEST', { ...page, page_path: '/en/premium' })
  const calls = target.dataLayer!.map(item => Array.from(item as ArrayLike<unknown>))
  assert.equal(calls.filter(call => call[0] === 'config').length, 1)
  assert.deepEqual(calls[1], ['config', 'G-TEST', { send_page_view: false }])
  assert.equal(calls.filter(call => call[1] === 'page_view').length, 2)
  assert.deepEqual(calls[2], ['event', 'page_view', page])
})

test('an existing loaded gtag function is preserved', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => { calls.push(args) }
  const target = { gtag }
  queueGooglePageView(target, 'G-TEST', { page_path: '/es', page_location: '', page_title: '' })
  assert.equal(target.gtag, gtag)
  assert.equal(calls.at(-1)?.[1], 'page_view')
})
