import { adminDb } from "@citybeat/lib/firebase/admin";
import { FOUNDING_LIMIT } from "@/lib/pricing";

/**
 * Is the Founding 100 launch offer still open?
 *
 * Counts listings already marked founding PLUS orders that are paid but have
 * not yet produced a listing — otherwise two people paying within the same
 * minute would both pass the check and the hundred-and-first founding member
 * would be sold a place that does not exist.
 *
 * This lives in a lib rather than inside one route because more than one
 * checkout path can now sell a founding plan: CityBeat's own sales desk and
 * the partner endpoint Elevate reps sell through. Two copies of a scarcity
 * limit is two places for it to drift, and the failure is overselling a
 * promise made publicly.
 *
 * Fails CLOSED. If Firestore cannot answer, the offer is treated as
 * unavailable: refusing a sale we could have made is recoverable, selling a
 * limited place we do not have is not.
 */
/**
 * Pure counting rule, separated from the Firestore reads so the double-count
 * regression stays pinned by unit tests.
 *
 * A paid Sales Desk founding sale gets `founding_member: true` on its listing
 * at PAYMENT time (directoryOrderPaymentPatch), while `fulfillment_target` is
 * only written when the customer later completes their content brief. Counting
 * "founding listings" and "paid orders without a fulfillment target" as
 * disjoint sets therefore counted every such sale TWICE — the promo closed at
 * roughly FIFTY real members, and the Sales Desk and the partner endpoint
 * started refusing founding sales while self-serve carried on selling them.
 */
export function countFoundingSpotsTaken(
  foundingListingIds: Iterable<string>,
  orders: Array<Record<string, unknown>>
): number {
  const countedListingIds = new Set<string>();
  for (const id of foundingListingIds) countedListingIds.add(String(id));
  const paidAwaitingListing = orders.filter((order) => {
    if (order.payment_status !== "paid" || order.fulfillment_target) return false;
    // Already represented by its listing — counting it again is the double-count.
    return !(order.listing_id && countedListingIds.has(String(order.listing_id)));
  }).length;
  return countedListingIds.size + paidAwaitingListing;
}

export async function foundingOfferAvailable(): Promise<boolean> {
  try {
    const [foundingListings, monthlyOrders, annualOrders] = await Promise.all([
      adminDb
        .collection("directory_listings")
        .where("founding_member", "==", true)
        .get(),
      adminDb
        .collection("sales_orders")
        .where("product_id", "==", "directory_founding_monthly")
        .get(),
      adminDb
        .collection("sales_orders")
        .where("product_id", "==", "directory_founding_annual")
        .get(),
    ]);
    const taken = countFoundingSpotsTaken(
      foundingListings.docs.map((d: any) => d.id),
      [...monthlyOrders.docs, ...annualOrders.docs].map((d: any) => d.data())
    );
    return taken < FOUNDING_LIMIT;
  } catch (error) {
    console.error("Could not confirm Founding availability:", error);
    return false;
  }
}
