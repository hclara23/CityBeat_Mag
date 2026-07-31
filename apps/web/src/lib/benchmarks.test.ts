import assert from 'node:assert/strict'
import test from 'node:test'
import { MIN_BENCHMARK_COHORT, computeCategoryBenchmark } from './benchmarks'

function cohort(n: number, base = { rating: 4, reviews: 5, views30: 100 }) {
  return Array.from({ length: n }, (_, i) => ({ id: `x${i}`, ...base }))
}

test('benchmarks require a minimum cohort of OTHER listings', () => {
  const few = computeCategoryBenchmark({
    category: 'restaurant',
    listingId: 'me',
    listings: [{ id: 'me', rating: 5 }, ...cohort(MIN_BENCHMARK_COHORT - 2)],
  })
  assert.equal(few.available, false)
  if (!few.available) assert.equal(few.reason, 'small_cohort')

  const enough = computeCategoryBenchmark({
    category: 'restaurant',
    listingId: 'me',
    listings: [{ id: 'me', rating: 5, reviews: 10, views30: 300 }, ...cohort(MIN_BENCHMARK_COHORT)],
  })
  assert.equal(enough.available, true)
})

test('averages exclude the requesting listing and compute rating percentile', () => {
  const res = computeCategoryBenchmark({
    category: 'shopping',
    listingId: 'me',
    minCohort: 3,
    listings: [
      { id: 'me', rating: 5, reviews: 20, views30: 500 },
      { id: 'a', rating: 3, reviews: 2, views30: 100 },
      { id: 'b', rating: 4, reviews: 4, views30: 200 },
      { id: 'c', rating: 4, reviews: 6, views30: 300 },
    ],
  })
  assert.equal(res.available, true)
  if (res.available) {
    assert.equal(res.cohort, 3)
    assert.equal(res.avg_rating, 3.7) // (3+4+4)/3 = 3.67 → 3.7
    assert.equal(res.your_rating, 5)
    assert.equal(res.your_views30, 500)
    assert.equal(res.avg_views30, 200) // (100+200+300)/3
    assert.equal(res.rating_percentile, 100) // 5 beats all 3
  }
})

test('a single rated competitor never leaks its rating (rating aggregate needs its own cohort)', () => {
  const res = computeCategoryBenchmark({
    category: 'events',
    listingId: 'me',
    minCohort: 5,
    listings: [
      { id: 'me', rating: 4.5 },
      { id: 'grand', rating: 4.2 }, // the ONLY rated competitor
      { id: 'a', rating: 0 },
      { id: 'b', rating: null },
      { id: 'c', rating: null },
      { id: 'd', rating: null },
    ],
  })
  assert.equal(res.available, true) // cohort of 5 others → views/reviews are fine
  if (res.available) {
    assert.equal(res.avg_rating, null) // only 1 rated other < minCohort → hidden
    assert.equal(res.rating_percentile, null)
  }
})

test('unrated listings and zero cohort ratings are handled', () => {
  const res = computeCategoryBenchmark({
    category: 'services',
    listingId: 'me',
    minCohort: 2,
    listings: [
      { id: 'me', rating: null, reviews: 0, views30: 10 },
      { id: 'a', rating: 0, reviews: 0, views30: 5 },
      { id: 'b', rating: null, reviews: 0, views30: 7 },
    ],
  })
  assert.equal(res.available, true)
  if (res.available) {
    assert.equal(res.avg_rating, null) // no rated others
    assert.equal(res.your_rating, null)
    assert.equal(res.rating_percentile, null)
  }
})
