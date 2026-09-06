import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TopN, scanCollection } from './firestore-scan'

// These two primitives replaced whole-collection .get() calls on the admin
// dashboards. Their whole job is to keep totals exact while memory stays
// bounded, so what matters is that they see every document and that the "most
// recent N" they hand back is the same list a full sort would have produced.

// A Firestore Query stub: pages through a fixed array via orderBy/limit/
// startAfter. `orderBy` is required — the scan orders explicitly by document id
// rather than relying on Firestore's implicit key order — and `onOrderBy` lets a
// test make it throw, to exercise the fallback path.
function fakeQuery(ids: string[], onOrderBy?: () => void) {
  const make = (offset: number, size: number | null) => {
    const slice = size === null ? ids.slice(offset) : ids.slice(offset, offset + size)
    const self: any = {
      orderBy() {
        onOrderBy?.()
        return self
      },
      limit(n: number) {
        return make(offset, n)
      },
      startAfter(cursor: any) {
        return make(ids.indexOf(cursor.id) + 1, size)
      },
      async get() {
        const docs = slice.map((id) => ({ id, data: () => ({ id }) }))
        return { empty: docs.length === 0, docs }
      },
    }
    return self
  }
  return make(0, null) as any
}

test('a scan visits every document exactly once across page boundaries', async () => {
  const ids = Array.from({ length: 1201 }, (_, i) => `d${String(i).padStart(5, '0')}`)
  const seen: string[] = []
  const result = await scanCollection(fakeQuery(ids), (d) => seen.push(d.id), { pageSize: 500 })

  assert.equal(result.scanned, 1201)
  assert.equal(result.truncated, false)
  assert.equal(seen.length, 1201, 'no document may be visited twice or skipped')
  assert.equal(new Set(seen).size, 1201)
  // A page boundary is exactly where a bad cursor loses or repeats a row.
  assert.equal(seen[499], ids[499])
  assert.equal(seen[500], ids[500])
})

test('a collection that ends exactly on a page boundary terminates', async () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `d${i}`)
  const seen: string[] = []
  const result = await scanCollection(fakeQuery(ids), (d) => seen.push(d.id), { pageSize: 500 })
  assert.equal(result.scanned, 1000)
  assert.equal(result.truncated, false)
})

test('an empty collection scans to zero, not to an error', async () => {
  const result = await scanCollection(fakeQuery([]), () => {}, { pageSize: 500 })
  assert.deepEqual(result, { scanned: 0, truncated: false })
})

test('hitting the cap is reported, never silently swallowed', async () => {
  // A total computed from part of a ledger is a wrong number presented as fact.
  // The caller can only say so if the scan admits it stopped early.
  const ids = Array.from({ length: 100 }, (_, i) => `d${i}`)
  const result = await scanCollection(fakeQuery(ids), () => {}, { pageSize: 10, cap: 30 })
  assert.equal(result.scanned, 30)
  assert.equal(result.truncated, true)
})

test('a collection exactly the size of the cap is complete, not truncated', async () => {
  // Reaching the cap was reported as truncation whether or not anything was
  // left behind, so a ledger of exactly `cap` rows made /admin/finance disclaim
  // a total that was complete and correct — the operator cannot act on a
  // number the page says it does not trust.
  const ids = Array.from({ length: 30 }, (_, i) => `d${String(i).padStart(3, '0')}`)
  const seen: string[] = []
  const result = await scanCollection(fakeQuery(ids), (d) => seen.push(d.id), { pageSize: 10, cap: 30 })
  assert.equal(result.scanned, 30)
  assert.equal(result.truncated, false)
  assert.equal(seen.length, 30)
})

test('the cap is a hard bound, not a bound plus one more page', async () => {
  // The page size was applied whole even when fewer rows remained under the
  // cap, so cap 750 with 500-row pages read 1000 documents. The cap exists to
  // bound memory and Firestore reads; overshooting it by a page defeats both.
  const ids = Array.from({ length: 1000 }, (_, i) => `d${String(i).padStart(4, '0')}`)
  const seen: string[] = []
  const result = await scanCollection(fakeQuery(ids), (d) => seen.push(d.id), { pageSize: 500, cap: 750 })
  assert.equal(result.scanned, 750)
  assert.equal(seen.length, 750)
  assert.equal(seen[749], ids[749])
  assert.equal(result.truncated, true)
})

test('TopN keeps exactly the highest-scoring items, in order', () => {
  const top = new TopN<string>(3)
  for (const s of ['2026-01-01', '2026-05-05', '2026-03-03', '2026-09-09', '2026-02-02']) {
    top.add(s, s)
  }
  assert.deepEqual(top.values(), ['2026-09-09', '2026-05-05', '2026-03-03'])
})

test('TopN matches a full sort, whatever order things arrive in', () => {
  const scores = Array.from({ length: 500 }, (_, i) => String(1000 + ((i * 37) % 500)))
  const top = new TopN<string>(10)
  for (const s of scores) top.add(s, s)
  const expected = [...scores].sort().reverse().slice(0, 10)
  assert.deepEqual(top.values(), expected)
})

test('TopN handles ties and fewer items than its limit', () => {
  const tie = new TopN<string>(2)
  tie.add('same', 'first')
  tie.add('same', 'second')
  assert.equal(tie.values().length, 2)

  const sparse = new TopN<string>(10)
  sparse.add('b', 'b')
  sparse.add('a', 'a')
  assert.deepEqual(sparse.values(), ['b', 'a'])

  assert.deepEqual(new TopN<string>(5).values(), [])
})

test('an undated row sorts last instead of displacing a real one', () => {
  // Rows reach TopN with '' when created_at is missing. Ranked naively as a
  // string that beats nothing, they would still have to lose to every real date.
  const top = new TopN<string>(2)
  top.add('', 'undated')
  top.add('2026-01-01', 'january')
  top.add('2026-02-02', 'february')
  assert.deepEqual(top.values(), ['february', 'january'])
})

test('an ordering the backend rejects falls back instead of failing the page', () => {
  // 500ing the operator's finance dashboard is worse than losing the ordering
  // guarantee, so a rejected orderBy retries the same page unordered.
  const ids = Array.from({ length: 25 }, (_, i) => `d${i}`)
  let calls = 0
  const query = fakeQuery(ids, () => {
    calls++
    throw new Error('index required')
  })
  const seen: string[] = []
  return scanCollection(query, (d) => seen.push(d.id), { pageSize: 10 }).then((res) => {
    assert.equal(res.scanned, 25)
    assert.equal(new Set(seen).size, 25)
    // Tried the ordered form once, then stopped trying.
    assert.equal(calls, 1)
  })
})
