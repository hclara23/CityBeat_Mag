import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_NOTIFY_PREFS,
  buildNotificationRecord,
  getNotifyPrefs,
  sanitizeNotifyPrefsPatch,
} from './notify-prefs'

test('email activity + monthly reports default ON; SMS defaults OFF (opt-in only)', () => {
  assert.deepEqual(getNotifyPrefs(null), DEFAULT_NOTIFY_PREFS)
  assert.deepEqual(getNotifyPrefs({}), DEFAULT_NOTIFY_PREFS)
  assert.equal(getNotifyPrefs({ notify_prefs: {} }).activity_email, true)
  assert.equal(getNotifyPrefs({ notify_prefs: {} }).sms_opt_in, false)
  // Explicit opt-outs are honored.
  assert.equal(getNotifyPrefs({ notify_prefs: { activity_email: false } }).activity_email, false)
  assert.equal(getNotifyPrefs({ notify_prefs: { monthly_report: false } }).monthly_report, false)
  // SMS requires a literal true.
  assert.equal(getNotifyPrefs({ notify_prefs: { sms_opt_in: 'yes' } }).sms_opt_in, false)
  assert.equal(getNotifyPrefs({ notify_prefs: { sms_opt_in: true } }).sms_opt_in, true)
})

test('prefs patch accepts only known boolean keys', () => {
  assert.deepEqual(sanitizeNotifyPrefsPatch({ activity_email: false, hack: true, sms_opt_in: 'true' }), {
    activity_email: false,
  })
  assert.deepEqual(sanitizeNotifyPrefsPatch(null), {})
  assert.deepEqual(sanitizeNotifyPrefsPatch([1]), {})
  assert.deepEqual(sanitizeNotifyPrefsPatch({ monthly_report: true, sms_opt_in: true }), {
    monthly_report: true,
    sms_opt_in: true,
  })
})

test('notification records are bounded, bilingual-defaulted, and start unread/undelivered', () => {
  const rec = buildNotificationRecord({
    type: 'review',
    title: 'New review',
    body: 'Someone left a 5-star review',
    link: '/dashboard/listings/abc',
    now: '2026-07-31T00:00:00.000Z',
  })
  assert.equal(rec.title_es, 'New review') // falls back to EN when no ES given
  assert.equal(rec.read_at, null)
  assert.equal(rec.email_sent, false) // delivery only recorded after a real send
  assert.equal(rec.link, '/dashboard/listings/abc')
  // Non-path links are dropped (no external/injected URLs in the inbox).
  assert.equal(
    buildNotificationRecord({ type: 'lead', title: 'x', link: 'https://evil.example', now: 'now' }).link,
    null
  )
  assert.equal(buildNotificationRecord({ type: 'lead', title: 'x'.repeat(300), now: 'n' }).title.length, 200)
})
