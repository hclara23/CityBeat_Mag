// Read-only public checks plus unauthenticated POSTs that must be rejected before SMS.
import assert from 'node:assert/strict'
const base = 'https://citybeatmag.co'
const slugs = ['alza-dwellings', 'desert-commons-east', 'desert-commons-west', 'ridgemar', 'sun-hollow', 'lake-fairway', 'spring-park', 'independence-place-el-paso', 'the-legends-of-el-paso', 'terralane-at-campo-del-sol']
const results = []
for (const locale of ['en', 'es']) {
  const directory = await fetch(`${base}/${locale}/apartments`)
  assert.equal(directory.status, 200)
  const directoryHtml = await directory.text()
  for (const slug of slugs) {
    assert.ok(directoryHtml.includes(`/${locale}/apartments/${slug}/claim`))
    const detail = await fetch(`${base}/${locale}/apartments/${slug}`)
    assert.equal(detail.status, 200)
    const detailHtml = await detail.text()
    assert.ok(detailHtml.includes(locale === 'en' ? 'Manage this property?' : 'Administras esta propiedad?'))
    assert.ok(detailHtml.includes('min-h-12'))
    const claim = await fetch(`${base}/${locale}/apartments/${slug}/claim`)
    assert.equal(claim.status, 200)
    const claimHtml = await claim.text()
    assert.ok(claimHtml.includes(locale === 'en' ? 'Claim this property' : 'Reclamar esta propiedad'))
    assert.ok(claimHtml.includes(`/${locale}/privacy`))
    assert.ok(claimHtml.includes(`/${locale}/terms`))
    results.push({ locale, slug, detail: detail.status, claim: claim.status, prominentButton: true })
  }
}
for (const slug of slugs) {
  const eligible = await fetch(`${base}/api/apartments/${slug}/claim`)
  assert.equal(eligible.status, 200)
  const eligibility = await eligible.json()
  assert.equal(eligibility.claimable, true)
  for (const action of ['start', 'verify']) {
    const res = await fetch(`${base}/api/apartments/${slug}/claim/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    assert.equal(res.status, 401, `${slug}/${action} must reject unsigned requests`)
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results, eligibilityChecks: 10, unsignedRejections: 20, smsSent: 0 }, null, 2))
