// How a refund is attributed across the `ad_purchases` rows that back one Stripe
// charge. Pure and unit-tested — no Firestore, no Next, no Stripe SDK: the
// webhook gathers the rows, this decides the numbers, the webhook writes them.
//
// `amount_refunded` on an ad_purchases row is not decoration. purchaseCollectedCents
// subtracts it, so finance and the weekly ops digest report collected revenue net
// of whatever is written here. A wrong figure is a silent accounting error that
// surfaces only when a month-end total disagrees with Stripe, by which point
// nobody remembers which refund did it.
//
// The rule, and why each branch has to exist:
//
//   FULL refund       — every backing row lost exactly its own amount_total. The
//                       charge total is irrelevant: each row is refunded its own
//                       price, and three rows summing to the charge is the point.
//   PARTIAL, ONE row  — the charge's cumulative amount_refunded IS that row's
//                       refund, because there is nothing else it could belong to.
//   PARTIAL, MANY     — Stripe reports that a charge was partially refunded; it
//                       never reports which line items the money came off. So
//                       NOTHING is written and the rows stay gross. Over-reporting
//                       revenue by the refunded amount is wrong; writing the whole
//                       refund onto whichever row a lookup happened to return
//                       first is wrong by several times as much and reads as
//                       authoritative. The partial-refund clawback path already
//                       pages a human, and that human can attribute it.
//
// The row COUNT is what makes the middle case safe, and it can only be counted
// once the UNION of backing rows is known. The webhook finds them through two
// different lookups (by payment_intent/session, and per sales_order), and each
// used to decide on its own — which is how a multi-item cart could end up with one
// arbitrary row carrying the entire cart's refund while its siblings stayed gross.

/**
 * Stripe's `charge.amount_refunded` is CUMULATIVE over every refund on the
 * charge, not the amount of the refund that just fired. "Fully refunded" is
 * therefore a comparison against the charge total, not a per-refund fact.
 * `charge.refunded` is Stripe's own verdict and is trusted first; the comparison
 * catches a charge refunded to the cent on an object where that flag was not set
 * (the dispute path synthesises one). This is the webhook's long-standing rule,
 * moved here unchanged — every downgrade, revocation and commission clawback in
 * the refund handler branches on it.
 */
export function isFullyRefunded(charge: {
  amount?: number | null
  amount_refunded?: number | null
  refunded?: boolean | null
}): boolean {
  return Boolean(charge.refunded) || Number(charge.amount_refunded || 0) >= Number(charge.amount || 0)
}

/** Whole positive cents, or null when the value cannot be trusted as money. */
function positiveCents(value: unknown): number | null {
  const cents = Math.round(Number(value))
  return Number.isFinite(cents) && cents > 0 ? cents : null
}

/**
 * The `amount_refunded` patch for each ad_purchases row backing one charge.
 * Returns an entry for every distinct row — an empty patch means "write no
 * amount_refunded", NOT "write zero"; the caller spreads the patch alongside the
 * status fields it is writing anyway.
 */
export function refundPatchForPurchaseRows(input: {
  fullyRefunded: boolean
  chargeAmountRefunded: number
  rows: Array<{ id: string; amount_total?: number | null }>
}): Array<{ id: string; patch: { amount_refunded?: number } }> {
  // A money field never receives a negative or non-numeric figure, whatever
  // Stripe or a replayed fixture hands us.
  const chargeRefunded = Math.max(0, Math.round(Number(input.chargeAmountRefunded) || 0))

  // The caller builds the union from two lookups that can legitimately return the
  // SAME document, and the row count is what decides whether a partial refund is
  // attributable at all. One row counted twice would look like a multi-item cart
  // and silently stop recording a refund that is perfectly well known.
  const rows: Array<{ id: string; amount_total?: number | null }> = []
  const seen = new Set<string>()
  for (const row of input.rows) {
    if (!row || !row.id || seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  if (!rows.length) return []

  if (input.fullyRefunded) {
    return rows.map((row) => {
      const own = positiveCents(row.amount_total)
      if (own !== null) return { id: row.id, patch: { amount_refunded: own } }
      // The row has no usable price. With exactly one row behind the charge the
      // charge's own cumulative refund is that row's refund, so it is still
      // exact. With several it is genuinely unknown — and 0 does not mean
      // "unknown", it asserts that a fully refunded row was refunded nothing,
      // which finance then subtracts as such.
      if (rows.length === 1 && chargeRefunded > 0) {
        return { id: row.id, patch: { amount_refunded: chargeRefunded } }
      }
      return { id: row.id, patch: {} }
    })
  }

  // Partial, one row: the cumulative charge refund belongs to it and to nothing
  // else. This is the common self-serve path.
  if (rows.length === 1) return [{ id: rows[0].id, patch: { amount_refunded: chargeRefunded } }]

  // Partial, several rows: unattributable from the charge alone. Leave them gross.
  return rows.map((row) => ({ id: row.id, patch: {} }))
}
