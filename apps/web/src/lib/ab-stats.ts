// First-touch A/B scoreboard for the outbound sales drip.
//
// The drip has been stamping `subject_variant` on every sales_outreach doc for
// months and NOTHING ever read it — the experiment ran blind. This module is the
// read side, and it is deliberately conservative: a scoreboard that crowns a
// winner on noise is worse than no scoreboard, because someone reweights a real
// campaign on it.
//
// Four things this module refuses to do, each learned from a concrete defect:
//
//  1. Compare unlike populations. The mirror arms (3 = Spanish description,
//     4 = accuracy audit) need listing data, so data-poor listings fall back to
//     the control. That made arm 0 a mixture of its own random share plus every
//     listing rejected from 3-4 — so "lift" measured listing quality, not copy.
//     Each arm is now compared against a MATCHED control cohort (control rows
//     that were themselves eligible for that arm), and rows whose assignment was
//     downgraded are excluded from the experiment entirely.
//  2. Call 30 sends "enough". At a 1-5% conversion rate you need roughly
//     1,100-3,800 per arm to detect a meaningful lift. `required_n` is computed
//     from the observed control rate, and the verdict waits for it.
//  3. Publish a p-value the normal approximation cannot support. The pooled
//     z-test is only used when the expected counts justify it; otherwise null.
//  4. Ignore multiplicity. Four arms against one control at a flat 0.05 crowns a
//     false winner ~19% of the time; Holm-Bonferroni fixes the threshold.
//
// Unit of analysis: ONE sales_outreach doc = one business = one arm. The arm
// controls the FIRST email of a 3-step sequence, so a claim is credited to the
// arm that opened the sequence — not to a subject line in isolation.
//
// Pure + dependency-free so it unit-tests without Firebase.

/** Statuses that mean the email actually reached a mailbox. */
const DELIVERED_STATUS = new Set(['sent', 'opened', 'clicked', 'converted', 'unsubscribed'])

/** The five first-touch arms. Index === the recorded subject_variant. */
export const ARMS: Array<{ key: number; label: string; label_es: string; note: string; note_es: string }> = [
  {
    key: 0,
    label: 'Listed — claim it free',
    label_es: 'Ya aparece — reclámalo gratis',
    note: 'Control. Standard pitch, subject A.',
    note_es: 'Control. Propuesta estándar, asunto A.',
  },
  {
    key: 1,
    label: 'Is this your business?',
    label_es: '¿Este es tu negocio?',
    note: 'Standard pitch, subject B.',
    note_es: 'Propuesta estándar, asunto B.',
  },
  {
    key: 2,
    label: 'Customers are finding you',
    label_es: 'Los clientes te buscan',
    note: 'Standard pitch, subject C.',
    note_es: 'Propuesta estándar, asunto C.',
  },
  {
    key: 3,
    label: 'Spanish mirror',
    label_es: 'Espejo en español',
    note: 'Quotes the listing’s own auto-translated Spanish description back to the owner. Needs description_es.',
    note_es: 'Le muestra al dueño la descripción en español de su propia ficha. Requiere description_es.',
  },
  {
    key: 4,
    label: 'Accuracy audit',
    label_es: 'Auditoría de datos',
    note: 'Shows the scraped phone/address/hours and asks whether they are still right. Needs a phone or address.',
    note_es: 'Muestra el teléfono/dirección/horario recopilados y pregunta si siguen correctos. Requiere teléfono o dirección.',
  },
]

/** Arm 0 is the control every other arm is tested against. */
export const CONTROL_ARM = 0

/** Enough rows to bother rendering a line. NOT enough to conclude anything. */
export const MIN_DISPLAY = 30

/** Relative lift the experiment is powered to detect (0.5 = a +50% improvement). */
export const TARGET_MDE = 0.5

/** A claim can land well after the 9-day drip; rows younger than this are still in flight. */
export const MATURITY_MS = 14 * 86400000

/**
 * Which control rows are a fair comparison for each arm. Arms 0-2 are pure
 * subject spins usable on any listing, so they compare against the whole control.
 * Arms 3-4 could only ever be sent to listings with the data they mirror.
 */
const ARM_ELIGIBILITY: Record<number, ((r: OutreachRow) => boolean) | null> = {
  0: null,
  1: null,
  2: null,
  3: (r) => r.had_description_es === true,
  4: (r) => r.had_contact_details === true,
}

export interface OutreachRow {
  subject_variant?: number | null
  variant_downgraded?: boolean | null
  had_description_es?: boolean | null
  had_contact_details?: boolean | null
  status?: string | null
  opens?: number | null
  clicks?: number | null
  step?: number | null
  created_at_ms?: number | null
  converted_at_ms?: number | null
}

export interface ArmStats {
  key: number
  label: string
  label_es: string
  note: string
  note_es: string
  delivered: number
  opened: number
  clicked: number
  converted: number
  unsubscribed: number
  in_flight: number
  open_rate: number
  click_rate: number
  conversion_rate: number
  unsub_rate: number
  /** Wilson 95% interval for the conversion rate — the honest range. */
  conversion_ci: [number, number]
  /** Size of the control cohort this arm is actually compared against. */
  matched_control_n: number
  matched_control_rate: number
  /** True when a like-for-like control cohort exists (arms 3-4 need the eligibility flags). */
  comparable: boolean
  /** Two-proportion p-value vs the MATCHED control (null when unsupportable). */
  p_vs_control: number | null
  /** Conversion lift vs the matched control as a ratio (1.4 = +40%). */
  lift_vs_control: number | null
  /** Direction of the difference, independent of whether lift is computable. */
  better_than_control: boolean
  /** Per-arm sample size needed to detect TARGET_MDE at the corrected alpha. */
  required_n: number
  /** Enough volume to READ the row (not to conclude). */
  displayable: boolean
  /** Enough volume for this arm's comparison to be conclusive. */
  powered: boolean
  first_sent_ms: number | null
  last_sent_ms: number | null
}

export interface ScoreboardVerdict {
  status: 'insufficient_data' | 'no_difference' | 'winner'
  winner: number | null
  message: string
  message_es: string
}

export interface Scoreboard {
  arms: ArmStats[]
  totals: { delivered: number; opened: number; clicked: number; converted: number; in_flight: number }
  verdict: ScoreboardVerdict
  min_display: number
  /** Holm-corrected significance threshold actually applied. */
  alpha: number
  /** Rows excluded because their arm assignment was downgraded (not randomized). */
  excluded_downgraded: number
  /** Delivered rows whose subject_variant was missing or unrecognized. */
  unbucketed: number
  /** Earliest date at which every arm with data was live — the fair window start. */
  aligned_since_ms: number | null
}

// ── statistics ──────────────────────────────────────────────────────────────

/** Abramowitz-Stegun 7.1.26 error function; |error| < 1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return sign * y
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Inverse normal CDF by bisection — accurate enough for sample-size math. */
export function probit(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  let lo = -10
  let hi = 10
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (normalCdf(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Wilson score interval — correct at small n and extreme rates, where the normal
 * approximation produces nonsense like negative lower bounds.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 0]
  const p = successes / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

/**
 * Two-tailed p-value for the difference between two proportions (pooled z-test).
 *
 * Returns null unless the EXPECTED counts support the normal approximation
 * (np >= 5 and n(1-p) >= 5 in both arms). Checking row counts instead — the
 * classic mistake — publishes wildly anti-conservative p-values exactly in the
 * low-conversion regime this drip lives in: 1 conversion out of 5 sends against
 * 0 out of 200 otherwise "computes" to p = 2e-10.
 */
export function twoProportionPValue(s1: number, n1: number, s2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null
  const pooled = (s1 + s2) / (n1 + n2)
  if (pooled <= 0 || pooled >= 1) return null
  if (pooled * n1 < 5 || pooled * n2 < 5 || (1 - pooled) * n1 < 5 || (1 - pooled) * n2 < 5) return null
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
  if (se === 0) return null
  const z = (s1 / n1 - s2 / n2) / se
  // Floor at the approximation's own resolution rather than reporting a 0 that
  // catastrophic cancellation produced.
  return Math.max(2 * (1 - normalCdf(Math.abs(z))), 1e-7)
}

/**
 * Per-arm sample size for `power` to detect a relative `mde` lift over
 * `baseline`, at two-sided `alpha`. Standard two-proportion formula.
 */
export function requiredSampleSize(baseline: number, mde = TARGET_MDE, alpha = 0.05, power = 0.8): number {
  const p1 = Math.min(Math.max(baseline, 0.0001), 0.9999)
  const p2 = Math.min(p1 * (1 + mde), 0.9999)
  const delta = p2 - p1
  if (delta <= 0) return Infinity
  const zA = probit(1 - alpha / 2)
  const zB = probit(power)
  const n = ((zA + zB) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) / (delta * delta)
  return Math.ceil(n)
}

// ── aggregation ─────────────────────────────────────────────────────────────

const rate = (num: number, den: number) => (den > 0 ? num / den : 0)

const isDelivered = (r: OutreachRow): boolean => {
  // Delivery is sticky: a doc that advanced past step 0, or ever converted, must
  // have had its first email delivered — even if a later follow-up failed and
  // rewrote the status.
  if (DELIVERED_STATUS.has(String(r.status || ''))) return true
  if ((r.step ?? 0) > 0) return true
  return (r.converted_at_ms ?? 0) > 0
}

// Conversion survives an unsubscribe, which overwrites `status` unconditionally.
const isConverted = (r: OutreachRow): boolean =>
  String(r.status) === 'converted' || (r.converted_at_ms ?? 0) > 0

// Engagement comes from the raw counters, which no writer overwrites. A
// conversion is NOT treated as an open or a click: claims arrive organically too,
// and counting them as engagement would correlate those columns with the outcome
// by construction.
const isOpened = (r: OutreachRow): boolean =>
  (Number(r.opens) || 0) > 0 || (Number(r.clicks) || 0) > 0 || ['opened', 'clicked'].includes(String(r.status))
const isClicked = (r: OutreachRow): boolean => (Number(r.clicks) || 0) > 0 || String(r.status) === 'clicked'

/** Strict arm parsing: only a real number (or an integer numeral) counts. */
function armOf(raw: unknown): number | null {
  const v =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : NaN
  return Number.isInteger(v) && ARM_ELIGIBILITY[v] !== undefined ? v : null
}

export function summarizeVariants(rows: OutreachRow[], opts: { sinceMs?: number; nowMs?: number } = {}): Scoreboard {
  const now = opts.nowMs ?? Date.now()
  const buckets = new Map<number, OutreachRow[]>()
  for (const arm of ARMS) buckets.set(arm.key, [])

  let excludedDowngraded = 0
  let unbucketed = 0
  let inFlightTotal = 0
  const inFlightByArm = new Map<number, number>()

  for (const r of rows) {
    if (!isDelivered(r)) continue // dry runs + failed first sends are not sends
    if (opts.sinceMs && (r.created_at_ms ?? 0) < opts.sinceMs) continue

    const arm = armOf(r?.subject_variant)
    if (arm === null) {
      unbucketed++
      continue
    }
    // A downgraded row was NOT randomly assigned to the arm it carries — it was
    // routed there by missing data. Including it is what broke the control.
    if (r.variant_downgraded === true) {
      excludedDowngraded++
      continue
    }
    // Too young for its outcome to be known; counted, not measured.
    if ((r.created_at_ms ?? 0) > 0 && now - (r.created_at_ms as number) < MATURITY_MS) {
      inFlightTotal++
      inFlightByArm.set(arm, (inFlightByArm.get(arm) || 0) + 1)
      continue
    }
    buckets.get(arm)!.push(r)
  }

  const controlRows = buckets.get(CONTROL_ARM) || []

  // First pass: per-arm counts and the matched-control comparison.
  const draft = ARMS.map((meta) => {
    const rs = buckets.get(meta.key) || []
    const delivered = rs.length
    const converted = rs.filter(isConverted).length
    const eligibility = ARM_ELIGIBILITY[meta.key]

    // Compare against control rows that could themselves have received this arm.
    const matched = eligibility ? controlRows.filter(eligibility) : controlRows
    const matchedN = matched.length
    const matchedConv = matched.filter(isConverted).length
    // For arms 3-4 the eligibility flags only exist on rows written after the fix;
    // with none present there is no honest comparison to make.
    const comparable = meta.key === CONTROL_ARM ? false : !eligibility || matchedN > 0

    const convRate = rate(converted, delivered)
    const matchedRate = rate(matchedConv, matchedN)

    return {
      meta,
      rs,
      delivered,
      converted,
      matchedN,
      matchedConv,
      comparable,
      convRate,
      matchedRate,
      p: comparable ? twoProportionPValue(converted, delivered, matchedConv, matchedN) : null,
    }
  })

  // Holm-Bonferroni over the arms actually being tested this run.
  const tested = draft.filter((d) => d.meta.key !== CONTROL_ARM && d.comparable && d.p !== null).length
  const alpha = tested > 0 ? 0.05 / tested : 0.05

  const arms: ArmStats[] = draft.map((d) => {
    const { meta, rs, delivered, converted, matchedN, matchedConv, comparable, convRate, matchedRate } = d
    const opened = rs.filter(isOpened).length
    const clicked = rs.filter(isClicked).length
    const unsubscribed = rs.filter((r) => String(r.status) === 'unsubscribed').length
    const times = rs.map((r) => r.created_at_ms || 0).filter((t) => t > 0)
    // Power the test off the matched control's rate (or the arm's own, if the
    // control has none yet) so the target reflects reality, not a guess.
    const baseline = matchedRate > 0 ? matchedRate : convRate > 0 ? convRate : 0.02
    const requiredN = requiredSampleSize(baseline, TARGET_MDE, alpha)

    return {
      key: meta.key,
      label: meta.label,
      label_es: meta.label_es,
      note: meta.note,
      note_es: meta.note_es,
      delivered,
      opened,
      clicked,
      converted,
      unsubscribed,
      in_flight: inFlightByArm.get(meta.key) || 0,
      open_rate: rate(opened, delivered),
      click_rate: rate(clicked, delivered),
      conversion_rate: convRate,
      unsub_rate: rate(unsubscribed, delivered),
      conversion_ci: wilsonInterval(converted, delivered),
      matched_control_n: meta.key === CONTROL_ARM ? 0 : matchedN,
      matched_control_rate: meta.key === CONTROL_ARM ? 0 : matchedRate,
      comparable,
      p_vs_control: d.p,
      lift_vs_control: meta.key === CONTROL_ARM || matchedRate <= 0 ? null : convRate / matchedRate,
      better_than_control: meta.key !== CONTROL_ARM && convRate > matchedRate,
      required_n: requiredN,
      displayable: delivered >= MIN_DISPLAY,
      powered: Number.isFinite(requiredN) && delivered >= requiredN && matchedN >= requiredN,
      first_sent_ms: times.length ? Math.min(...times) : null,
      last_sent_ms: times.length ? Math.max(...times) : null,
    }
  })

  const totals = arms.reduce(
    (acc, a) => ({
      delivered: acc.delivered + a.delivered,
      opened: acc.opened + a.opened,
      clicked: acc.clicked + a.clicked,
      converted: acc.converted + a.converted,
      in_flight: inFlightTotal,
    }),
    { delivered: 0, opened: 0, clicked: 0, converted: 0, in_flight: inFlightTotal }
  )

  const firsts = arms.filter((a) => a.delivered > 0 && a.first_sent_ms).map((a) => a.first_sent_ms as number)

  return {
    arms,
    totals,
    verdict: decideVerdict(arms, alpha),
    min_display: MIN_DISPLAY,
    alpha,
    excluded_downgraded: excludedDowngraded,
    unbucketed,
    aligned_since_ms: firsts.length ? Math.max(...firsts) : null,
  }
}

/**
 * Crown a winner only when the arm is POWERED (not merely non-empty), has a
 * like-for-like control cohort, beats it, clears the multiplicity-corrected
 * threshold, and is not burning the list faster than the control.
 */
export function decideVerdict(arms: ArmStats[], alpha = 0.05): ScoreboardVerdict {
  const control = arms.find((a) => a.key === CONTROL_ARM)
  const candidates = arms.filter((a) => a.key !== CONTROL_ARM && a.comparable && a.powered)

  if (!control || candidates.length === 0) {
    const target = arms.find((a) => a.key !== CONTROL_ARM && Number.isFinite(a.required_n))?.required_n
    const need = target && Number.isFinite(target) ? Math.round(target).toLocaleString() : 'far more'
    return {
      status: 'insufficient_data',
      winner: null,
      message: `Not conclusive yet — at the current claim rate each arm needs about ${need} delivered emails (and a matching control cohort) to detect a ${Math.round(TARGET_MDE * 100)}% improvement. Rates below are real but still noisy.`,
      message_es: `Aún no es concluyente — con la tasa actual, cada variante necesita unos ${need} correos entregados (y un control comparable) para detectar una mejora del ${Math.round(TARGET_MDE * 100)}%. Las tasas de abajo son reales pero todavía ruidosas.`,
    }
  }

  const winners = candidates
    .filter((a) => a.p_vs_control !== null && a.p_vs_control < alpha && a.better_than_control)
    // Don't recommend an arm that converts slightly better while burning the list.
    .filter((a) => a.unsub_rate <= (control.unsub_rate || 0) * 1.5 + 0.005)
    .sort((a, b) => b.conversion_rate - a.conversion_rate)

  if (winners.length === 0) {
    return {
      status: 'no_difference',
      winner: null,
      message: `No arm beats its matched control at the corrected threshold (p < ${alpha.toFixed(4)} for ${candidates.length} simultaneous comparisons). Keep every arm running.`,
      message_es: `Ninguna variante supera a su control comparable en el umbral corregido (p < ${alpha.toFixed(4)} para ${candidates.length} comparaciones simultáneas). Mantén todas activas.`,
    }
  }

  const best = winners[0]
  const liftPct = best.lift_vs_control !== null ? Math.round((best.lift_vs_control - 1) * 100) : null
  const liftEn = liftPct !== null ? ` by ${liftPct}%` : ''
  const liftEs = liftPct !== null ? ` por ${liftPct}%` : ''
  return {
    status: 'winner',
    winner: best.key,
    message: `"${best.label}" beats its matched control${liftEn} (p=${best.p_vs_control!.toFixed(4)}, threshold ${alpha.toFixed(4)}). Worth weighting new sends toward it.`,
    message_es: `"${best.label_es}" supera a su control comparable${liftEs} (p=${best.p_vs_control!.toFixed(4)}, umbral ${alpha.toFixed(4)}). Vale la pena enviar más con esa variante.`,
  }
}
