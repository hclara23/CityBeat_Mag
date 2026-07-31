// Category/competitor benchmarks for Featured listings. Privacy-safe: aggregates
// only, and only when the anonymized cohort is large enough (minimum cohort size)
// so no single competitor's numbers can be inferred. Pure + tested.

export const MIN_BENCHMARK_COHORT = 5

export type BenchmarkCohortListing = {
  id: string
  rating?: number | null
  reviews?: number | null
  views30?: number | null
}

export type BenchmarkResult =
  | { available: false; reason: 'small_cohort'; cohort: number; category: string }
  | {
      available: true
      category: string
      cohort: number // number of OTHER listings compared against
      avg_rating: number | null
      your_rating: number | null
      avg_reviews: number
      your_reviews: number
      avg_views30: number
      your_views30: number
      rating_percentile: number | null // 0–100, where you rank on rating
    }

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function computeCategoryBenchmark(input: {
  category: string
  listingId: string
  listings: BenchmarkCohortListing[]
  minCohort?: number
}): BenchmarkResult {
  const minCohort = input.minCohort ?? MIN_BENCHMARK_COHORT
  const self = input.listings.find((l) => l.id === input.listingId) || {
    id: input.listingId,
    rating: null,
    reviews: 0,
    views30: 0,
  }
  const others = input.listings.filter((l) => l.id !== input.listingId)

  // Cohort = the OTHER listings you're compared against. Need enough of them.
  if (others.length < minCohort) {
    return { available: false, reason: 'small_cohort', cohort: others.length, category: input.category }
  }

  const ratedOthers = others.map((l) => Number(l.rating)).filter((n) => Number.isFinite(n) && n > 0)
  const avgRating = ratedOthers.length ? Math.round(mean(ratedOthers) * 10) / 10 : null
  const yourRating = Number.isFinite(Number(self.rating)) && Number(self.rating) > 0 ? Number(self.rating) : null

  // Rating percentile: share of others you meet-or-beat (only when you have one).
  let ratingPercentile: number | null = null
  if (yourRating != null && ratedOthers.length > 0) {
    const beaten = ratedOthers.filter((r) => yourRating >= r).length
    ratingPercentile = Math.round((beaten / ratedOthers.length) * 100)
  }

  return {
    available: true,
    category: input.category,
    cohort: others.length,
    avg_rating: avgRating,
    your_rating: yourRating,
    avg_reviews: Math.round(mean(others.map((l) => Number(l.reviews) || 0))),
    your_reviews: Number(self.reviews) || 0,
    avg_views30: Math.round(mean(others.map((l) => Number(l.views30) || 0))),
    your_views30: Number(self.views30) || 0,
    rating_percentile: ratingPercentile,
  }
}
