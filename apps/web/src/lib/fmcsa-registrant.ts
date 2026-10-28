/**
 * Is an FMCSA registrant an individual rather than a company?
 *
 * The census has no field for a home address and `business_org_desc` — the one
 * field that names the entity type — is blank for 96% of active carriers in the
 * region, so neither can be used to find sole proprietors. What the record DOES
 * carry is who the registrant is: when `company_officer_1` is the same person as
 * `legal_name`, the entity is the individual.
 *
 * This compares two fields WITHIN ONE RECORD. It is not a heuristic on how a
 * business name looks, which is the mistake that produced a wrong conclusion
 * about the category keyword table earlier — that fed names into a function that
 * only ever receives category labels.
 *
 * The test is order-insensitive and subset-based, because the same person is
 * written both ways: "MARTINEZ LAURA" against "LAURA A MARTINEZ", or an officer
 * "JASON MORALES" against a legal name "JASON MORALES TRUCKING". It requires at
 * least two tokens in the shorter name, so a surname alone — which proves
 * nothing — never matches.
 *
 * KNOWN LIMITS, recorded so nobody mistakes it for a classifier:
 *   - It is NOISY in the false-positive direction: a few filers type the company
 *     name into the officer field, so "J & E Truck" matches itself.
 *   - It MISSES individuals whose officer field is blank or differs from the
 *     legal name entirely.
 * It is a review-and-hold signal for a privacy action, where over-pulling is the
 * safe direction, not a verdict on any single row.
 */
const tokens = (value: unknown): Set<string> =>
  new Set(
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
  )

export function officerIsEntity(officer: unknown, legalName: unknown): boolean {
  const a = tokens(officer)
  const b = tokens(legalName)
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  return small.size >= 2 && [...small].every((token) => big.has(token))
}

/**
 * The value written to a listing once a person has looked at it and decided it
 * is NOT an individual. Stored as `hold_review` on the listing.
 */
export const HOLD_REVIEWED_NOT_INDIVIDUAL = 'not_individual'

/**
 * Which signal, if any, says this carrier should be held — with a human's
 * decision outranking both.
 *
 * WHY THE REVIEW OUTRANKS THE RULE. The officer rule is noisy: it matches
 * "J & E Truck" with itself because the filer typed the company name into the
 * officer field. Restoring such a row is a human correcting the rule, but the
 * rule still matches it. Without a durable "reviewed" marker, the next run of
 * the hold script would re-hold every restored row and silently undo that
 * decision — the same failure as an unpublish that a bulk-publish reverses,
 * in the other direction.
 *
 * Returns the signal that fired ('both' when the officer rule and the registry
 * agree), or null when there is nothing to hold or a person has already ruled.
 */
export function holdSignal(input: {
  officer: unknown
  legalName: unknown
  businessOrgDesc: unknown
  reviewed: unknown
}): 'officer' | 'registry' | 'both' | null {
  if (input.reviewed === HOLD_REVIEWED_NOT_INDIVIDUAL) return null
  const byOfficer = officerIsEntity(input.officer, input.legalName)
  const byRegistry = input.businessOrgDesc === 'INDIVIDUAL'
  if (byOfficer && byRegistry) return 'both'
  if (byOfficer) return 'officer'
  if (byRegistry) return 'registry'
  return null
}
