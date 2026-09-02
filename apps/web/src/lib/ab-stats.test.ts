import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARMS,
  CONTROL_ARM,
  MATURITY_MS,
  MIN_DISPLAY,
  decideVerdict,
  normalCdf,
  probit,
  requiredSampleSize,
  summarizeVariants,
  twoProportionPValue,
  wilsonInterval,
  type OutreachRow,
} from './ab-stats'

const close = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps
const NOW = 1_800_000_000_000
const OLD = NOW - 60 * 86400000 // safely past MATURITY_MS

/** n mature rows for one arm, `conv` of them converted. */
function rows(variant: number, n: number, conv = 0, extra: Partial<OutreachRow> = {}): OutreachRow[] {
  return Array.from({ length: n }, (_, i) => ({
    subject_variant: variant,
    status: i < conv ? 'converted' : 'sent',
    opens: 0,
    clicks: 0,
    created_at_ms: OLD + i,
    ...extra,
  }))
}

test('normalCdf and probit are mutually consistent at known z values', () => {
  assert.ok(close(normalCdf(0), 0.5))
  assert.ok(close(normalCdf(1.96), 0.975, 2e-3))
  assert.ok(close(normalCdf(-1.96), 0.025, 2e-3))
  assert.ok(close(probit(0.975), 1.96, 5e-3))
  assert.ok(close(probit(0.8), 0.8416, 5e-3))
})

test('wilsonInterval matches textbook values and stays inside [0,1]', () => {
  const [lo, hi] = wilsonInterval(5, 10)
  assert.ok(close(lo, 0.2366, 5e-3), `lo=${lo}`)
  assert.ok(close(hi, 0.7634, 5e-3), `hi=${hi}`)
  const [lo0, hi0] = wilsonInterval(0, 20)
  assert.equal(lo0, 0)
  assert.ok(close(hi0, 0.1611, 5e-3), `hi0=${hi0}`)
  assert.ok(wilsonInterval(20, 20)[1] <= 1)
  assert.deepEqual(wilsonInterval(0, 0), [0, 0])
})

test('p-value is withheld unless the normal approximation is actually valid', () => {
  // Valid regime: matches textbook.
  assert.ok(close(twoProportionPValue(30, 100, 10, 100)!, 0.00041, 5e-4))
  assert.ok(twoProportionPValue(10, 100, 10, 100)! > 0.99)

  // The review's counterexamples — all must be null, not a confident number.
  assert.equal(twoProportionPValue(1, 5, 0, 200), null, '1/5 vs 0/200 must not compute')
  assert.equal(twoProportionPValue(2, 6, 10, 500), null, 'expected counts too small')
  assert.equal(twoProportionPValue(4, 30, 0, 30), null, 'the 30-send "winner" must not compute')
  assert.equal(twoProportionPValue(0, 50, 0, 50), null, 'no variance at all')
  assert.equal(twoProportionPValue(1, 3, 0, 2), null)
  assert.equal(twoProportionPValue(0, 0, 0, 0), null)

  // Never returns a hard 0 that cancellation produced.
  const extreme = twoProportionPValue(300, 300, 0, 300)
  assert.ok(extreme === null || extreme > 0, 'p must never be exactly 0')
})

test('requiredSampleSize reflects real power, not wishful thinking', () => {
  // Cross-checked against independently computed power tables:
  // 2% -> 3% (+50% relative) needs ~3,826/arm; 2% -> 4% (+100%) needs ~1,141.
  const n = requiredSampleSize(0.02, 0.5, 0.05, 0.8)
  assert.ok(Math.abs(n - 3826) < 60, `2%->3% n=${n}, expected ~3826`)
  const nDouble = requiredSampleSize(0.02, 1.0, 0.05, 0.8)
  assert.ok(Math.abs(nDouble - 1141) < 40, `2%->4% n=${nDouble}, expected ~1141`)
  // Rarer conversions need more.
  assert.ok(requiredSampleSize(0.01, 0.5) > requiredSampleSize(0.05, 0.5))
  // A stricter (multiplicity-corrected) alpha needs more.
  assert.ok(requiredSampleSize(0.02, 0.5, 0.0125) > requiredSampleSize(0.02, 0.5, 0.05))
  // It is always far above the display threshold — the old MIN_SAMPLE=30 bug.
  assert.ok(n > MIN_DISPLAY * 10)
})

test('downgraded assignments are excluded — they are not randomized', () => {
  // The defect: data-poor listings that hashed to arm 3/4 were stamped arm 0,
  // contaminating the control with systematically worse listings.
  const data = [
    ...rows(0, 10, 0, { variant_downgraded: false }),
    ...rows(0, 40, 0, { variant_downgraded: true }), // dumped into control
  ]
  const board = summarizeVariants(data, { nowMs: NOW })
  assert.equal(board.arms.find((a) => a.key === 0)!.delivered, 10)
  assert.equal(board.excluded_downgraded, 40)
})

test('arms 3-4 compare only against an ELIGIBLE control cohort', () => {
  const control = [
    ...rows(0, 100, 10, { had_description_es: true }), // 10% — comparable cohort
    ...rows(0, 100, 0, { had_description_es: false }), // 0%  — could never get arm 3
  ]
  const arm3 = rows(3, 100, 12, { had_description_es: true })
  const board = summarizeVariants([...control, ...arm3], { nowMs: NOW })
  const a3 = board.arms.find((a) => a.key === 3)!
  assert.equal(a3.matched_control_n, 100, 'ineligible control rows must be excluded')
  assert.ok(close(a3.matched_control_rate, 0.10), `matched rate=${a3.matched_control_rate}`)
  // Against the FULL control (5%) arm 3 would look like +140%; against the fair
  // cohort (10%) it is only +20%. The confounded number must not be reported.
  assert.ok(a3.lift_vs_control !== null && a3.lift_vs_control < 1.5, `lift=${a3.lift_vs_control}`)
  // Arms 1-2 need no restriction.
  const a1 = board.arms.find((a) => a.key === 1)!
  assert.equal(a1.matched_control_n, 200)
})

test('arm 3 is not comparable when no control row carries the eligibility flag', () => {
  // Legacy data written before the flags existed.
  const board = summarizeVariants([...rows(0, 100, 5), ...rows(3, 100, 20)], { nowMs: NOW })
  const a3 = board.arms.find((a) => a.key === 3)!
  assert.equal(a3.comparable, false)
  assert.equal(a3.p_vs_control, null)
  assert.notEqual(board.verdict.status, 'winner')
})

test('the 30-send "winner" the review reproduced is now refused', () => {
  const board = summarizeVariants([...rows(CONTROL_ARM, 30, 0), ...rows(3, 30, 4, { had_description_es: true })], {
    nowMs: NOW,
  })
  assert.equal(board.verdict.status, 'insufficient_data')
  assert.equal(board.verdict.winner, null)
})

test('a genuinely powered, significant, matched win IS crowned', () => {
  const control = rows(CONTROL_ARM, 6000, 120, { had_description_es: true }) // 2%
  const arm3 = rows(3, 6000, 300, { had_description_es: true }) // 5%
  const board = summarizeVariants([...control, ...arm3], { nowMs: NOW })
  const a3 = board.arms.find((a) => a.key === 3)!
  assert.equal(a3.powered, true)
  assert.ok(a3.p_vs_control !== null && a3.p_vs_control < board.alpha)
  assert.equal(board.verdict.status, 'winner')
  assert.equal(board.verdict.winner, 3)
  assert.ok(board.verdict.message_es.length > 0, 'verdict must be bilingual')
})

test('multiplicity: alpha tightens with the number of arms tested', () => {
  const one = summarizeVariants([...rows(0, 3000, 60), ...rows(1, 3000, 90)], { nowMs: NOW })
  const two = summarizeVariants([...rows(0, 3000, 60), ...rows(1, 3000, 90), ...rows(2, 3000, 90)], { nowMs: NOW })
  assert.ok(two.alpha < one.alpha, `${two.alpha} should be stricter than ${one.alpha}`)
  assert.ok(one.alpha <= 0.05)
})

test('a significantly WORSE arm is never crowned', () => {
  const board = summarizeVariants([...rows(CONTROL_ARM, 6000, 300), ...rows(1, 6000, 120)], { nowMs: NOW })
  assert.notEqual(board.verdict.status, 'winner')
  const a1 = board.arms.find((a) => a.key === 1)!
  assert.equal(a1.better_than_control, false)
})

test('an arm that converts better but burns the list is not recommended', () => {
  const control = rows(CONTROL_ARM, 6000, 120)
  const spammy = rows(1, 6000, 300).map((r, i) => (i < 900 ? { ...r, status: 'unsubscribed' } : r))
  const board = summarizeVariants([...control, ...spammy], { nowMs: NOW })
  const a1 = board.arms.find((a) => a.key === 1)!
  assert.ok(a1.unsub_rate > 0.1)
  assert.notEqual(board.verdict.winner, 1)
})

test('conversion survives an unsubscribe that overwrote the status', () => {
  const data: OutreachRow[] = [
    { subject_variant: 1, status: 'unsubscribed', converted_at_ms: OLD + 5, created_at_ms: OLD },
    { subject_variant: 1, status: 'unsubscribed', opens: 2, clicks: 1, created_at_ms: OLD },
  ]
  const board = summarizeVariants(data, { nowMs: NOW })
  const a1 = board.arms.find((a) => a.key === 1)!
  assert.equal(a1.delivered, 2)
  assert.equal(a1.converted, 1, 'converted_at must rescue the conversion')
  assert.equal(a1.unsubscribed, 2)
  assert.equal(a1.opened, 1)
  assert.equal(a1.clicked, 1)
})

test('delivery is sticky: a failed follow-up cannot erase a delivered first touch', () => {
  const data: OutreachRow[] = [{ subject_variant: 2, status: 'send_failed', step: 2, created_at_ms: OLD }]
  assert.equal(summarizeVariants(data, { nowMs: NOW }).arms.find((a) => a.key === 2)!.delivered, 1)
  // A first touch that genuinely never sent stays excluded.
  const never: OutreachRow[] = [{ subject_variant: 2, status: 'send_failed', step: 0, created_at_ms: OLD }]
  assert.equal(summarizeVariants(never, { nowMs: NOW }).arms.find((a) => a.key === 2)!.delivered, 0)
})

test('a conversion is not counted as an open or a click', () => {
  // Claims arrive organically; treating them as engagement would correlate the
  // engagement columns with the outcome by construction.
  const board = summarizeVariants(rows(0, 10, 10), { nowMs: NOW })
  const a0 = board.arms.find((a) => a.key === 0)!
  assert.equal(a0.converted, 10)
  assert.equal(a0.opened, 0)
  assert.equal(a0.clicked, 0)
})

test('immature rows are held out of the measurement, not silently counted', () => {
  const fresh = rows(0, 5, 0).map((r) => ({ ...r, created_at_ms: NOW - MATURITY_MS / 2 }))
  const board = summarizeVariants([...rows(0, 10, 1), ...fresh], { nowMs: NOW })
  const a0 = board.arms.find((a) => a.key === 0)!
  assert.equal(a0.delivered, 10)
  assert.equal(a0.in_flight, 5)
  assert.equal(board.totals.in_flight, 5)
})

test('unparseable arm values never fall into the control', () => {
  // Number(null|false|' '|[]) === 0 would all have become "control".
  const junk: OutreachRow[] = [
    { subject_variant: null, status: 'sent', created_at_ms: OLD },
    { subject_variant: undefined, status: 'sent', created_at_ms: OLD },
    { subject_variant: false as unknown as number, status: 'sent', created_at_ms: OLD },
    { subject_variant: ' ' as unknown as number, status: 'sent', created_at_ms: OLD },
    { subject_variant: [] as unknown as number, status: 'sent', created_at_ms: OLD },
    { subject_variant: 99, status: 'sent', created_at_ms: OLD },
  ]
  const board = summarizeVariants(junk, { nowMs: NOW })
  assert.equal(board.arms.find((a) => a.key === 0)!.delivered, 0)
  assert.equal(board.unbucketed, junk.length)
  // ...but a numeric string is still a legitimate arm.
  const str = summarizeVariants([{ subject_variant: '3' as unknown as number, status: 'sent', created_at_ms: OLD }], { nowMs: NOW })
  assert.equal(str.arms.find((a) => a.key === 3)!.delivered, 1)
})

test('sinceMs window and aligned_since_ms support fair comparison', () => {
  const early = rows(0, 3, 0).map((r, i) => ({ ...r, created_at_ms: OLD + i }))
  const late = rows(3, 3, 0, { had_description_es: true }).map((r, i) => ({ ...r, created_at_ms: OLD + 10_000 + i }))
  const board = summarizeVariants([...early, ...late], { nowMs: NOW })
  assert.equal(board.aligned_since_ms, OLD + 10_000, 'aligned window starts when the last arm went live')
  const windowed = summarizeVariants([...early, ...late], { nowMs: NOW, sinceMs: OLD + 10_000 })
  assert.equal(windowed.arms.find((a) => a.key === 0)!.delivered, 0)
})

test('empty input is safe, readable, and bilingual', () => {
  const board = summarizeVariants([], { nowMs: NOW })
  assert.equal(board.totals.delivered, 0)
  assert.equal(board.verdict.status, 'insufficient_data')
  assert.ok(board.verdict.message.length > 0 && board.verdict.message_es.length > 0)
  assert.equal(board.arms.length, ARMS.length)
  for (const a of board.arms) {
    assert.equal(a.delivered, 0)
    assert.deepEqual(a.conversion_ci, [0, 0])
    assert.equal(a.powered, false)
  }
  assert.equal(decideVerdict([]).status, 'insufficient_data')
})

test('every arm carries bilingual labels and notes', () => {
  for (const a of ARMS) {
    assert.ok(a.label && a.label_es && a.note && a.note_es, `arm ${a.key} missing i18n`)
  }
})
