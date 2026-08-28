import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIRECTORY_PLANS, PlanId, getPlan, FOUNDING_LIMIT } from './pricing'

const PLAN_IDS = Object.keys(DIRECTORY_PLANS) as PlanId[]

// The money-safety invariant: the price we SHOW (priceLabel) must equal the
// price we CHARGE (unitAmount). Editing one without the other would display one
// price and bill another — the worst kind of pricing bug.
test('every plan priceLabel matches its unitAmount', () => {
  for (const id of PLAN_IDS) {
    const plan = DIRECTORY_PLANS[id]
    const m = plan.priceLabel.match(/\$([\d,]+(?:\.\d{2})?)/)
    assert.ok(m, `${id}: priceLabel "${plan.priceLabel}" has no dollar figure`)
    const dollars = Number(m![1].replace(/,/g, ''))
    assert.equal(
      Math.round(dollars * 100),
      plan.unitAmount,
      `${id}: label ${plan.priceLabel} ($${dollars}) != unitAmount ${plan.unitAmount}c`
    )
  }
})

test('plan ids, tiers and intervals are internally consistent', () => {
  for (const id of PLAN_IDS) {
    const plan = DIRECTORY_PLANS[id]
    assert.equal(plan.id, id, `${id}: id field mismatch`)
    assert.ok(['premium', 'featured'].includes(plan.tier), `${id}: bad tier ${plan.tier}`)
    assert.ok(['month', 'year'].includes(plan.interval), `${id}: bad interval`)
    assert.ok(Number.isInteger(plan.unitAmount) && plan.unitAmount > 0, `${id}: unitAmount must be positive integer cents`)
    // Annual plan ids and labels must actually be yearly, and vice versa.
    if (id.includes('annual')) assert.equal(plan.interval, 'year', `${id}: annual id but not year interval`)
  }
})

test('founding + sponsored flags are set on exactly the intended plans', () => {
  const founding = PLAN_IDS.filter((id) => DIRECTORY_PLANS[id].founding)
  assert.deepEqual(founding.sort(), ['founding', 'founding_annual'])
  const sponsored = PLAN_IDS.filter((id) => DIRECTORY_PLANS[id].sponsored)
  assert.deepEqual(sponsored, ['sponsored_monthly'])
  // The Founding launch price is the locked $9.99/mo the sales copy promises.
  assert.equal(DIRECTORY_PLANS.founding.unitAmount, 999)
  assert.equal(FOUNDING_LIMIT, 100)
})

test('getPlan resolves known ids and rejects anything else', () => {
  assert.equal(getPlan('premium_monthly')?.id, 'premium_monthly')
  assert.equal(getPlan('featured_monthly')?.tier, 'featured')
  assert.equal(getPlan('nope'), null)
  assert.equal(getPlan(''), null)
  assert.equal(getPlan(null), null)
  assert.equal(getPlan(undefined), null)
})
