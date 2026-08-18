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
export async function foundingOfferAvailable(): Promise<boolean> {
  try {
    const [listingCount, monthlyOrders, annualOrders] = await Promise.all([
      adminDb
        .collection("directory_listings")
        .where("founding_member", "==", true)
        .count()
        .get()
        .then((snapshot: any) => snapshot.data().count),
      adminDb
        .collection("sales_orders")
        .where("product_id", "==", "directory_founding_monthly")
        .get(),
      adminDb
        .collection("sales_orders")
        .where("product_id", "==", "directory_founding_annual")
        .get(),
    ]);
    const paidAwaitingListing = [
      ...monthlyOrders.docs,
      ...annualOrders.docs,
    ].filter((document) => {
      const order = document.data();
      return order.payment_status === "paid" && !order.fulfillment_target;
    }).length;
    return listingCount + paidAwaitingListing < FOUNDING_LIMIT;
  } catch (error) {
    console.error("Could not confirm Founding availability:", error);
    return false;
  }
}
