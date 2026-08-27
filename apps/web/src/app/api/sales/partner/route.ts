import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@citybeat/lib/firebase/admin";
import { getPlan } from "@/lib/pricing";
import {
  resolveSalesProductRequest,
  salesProductAmount,
  salesProductPriceLabel,
} from "@/lib/sales-products";
import {
  buildSalesOrderRecord,
  createSalesOrderAccess,
  salesOrderCheckoutUrls,
  salesOrderStripeMetadata,
} from "@/lib/sales-orders";
import {
  isValidSalesEmail,
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringCheckoutDefaults,
  resolveDirectoryCategory,
} from "@/lib/sales-checkout";
import {
  buildSalesDirectoryListingRecord,
  salesDirectoryListingUrl,
} from "@/lib/sales-directory";
import { foundingOfferAvailable } from "@/lib/sales-founding";
import { partnerSalesProducts } from "@/lib/partner-catalog";
import { verifyPartnerRequest } from "@/lib/partner-signing";
import Stripe from "stripe";

/**
 * Partner sales endpoint — Elevate El Paso reps selling CityBeat.
 *
 * Elevate reps work a shared El Paso book of business. Rather than issue every
 * rep a second CityBeat login (and then have to deprovision it when they
 * leave), Elevate's SERVER proves its own identity with a signed request and
 * vouches for the rep by name.
 *
 * This route deliberately allows LESS than a logged-in CityBeat salesperson:
 *
 *   - No verification bypass. Attesting that a business is who it claims to be
 *     is a judgement a CityBeat salesperson makes under their own login and
 *     their own audit row. A partner cannot make it on their behalf.
 *   - No merging into an existing listing. A partner sale creates a new
 *     listing or nothing — it cannot attach billing to a business record it
 *     did not create and cannot see.
 *   - No payout attribution inside CityBeat. Elevate pays its own reps.
 *
 * Everything else — prices, order records, listing records, checkout URLs — is
 * computed by the same helpers the first-party route uses, so there is one
 * source of truth for what a CityBeat product costs and what a CityBeat order
 * looks like. The partner supplies WHO and WHICH. It supplies HOW MUCH only
 * for the explicit manager-approved custom one-time product.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Namespaced so a partner id can never collide with a Firebase uid. */
function partnerSellerId(repId: string): string {
  return `partner:elevate:${repId}`.slice(0, 120);
}

function refuse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: NextRequest) {
  const secret = process.env.ELEVATE_PARTNER_SECRET?.trim();
  if (!secret) {
    // 503, not 500: the route is correct, the deployment is incomplete. An
    // operator reading this needs to know it is a missing variable and not a
    // bug in the handler.
    return refuse(
      "Partner sales are not configured on this deployment",
      503,
      "partner_not_configured",
    );
  }

  // The raw body is read as text FIRST. Signatures cover exact bytes, and
  // parsing then re-serialising would verify a different string than the one
  // Elevate signed — key order and whitespace would silently break it.
  const raw = await request.text();
  const verified = verifyPartnerRequest(
    raw,
    {
      "x-elevate-timestamp": request.headers.get("x-elevate-timestamp"),
      "x-elevate-signature": request.headers.get("x-elevate-signature"),
    },
    secret,
  );
  if (!verified.valid) {
    // The reason is logged, never returned. Telling a caller "stale" versus
    // "bad signature" hands an attacker a debugging aid.
    console.warn(
      JSON.stringify({
        event: "partner_request_rejected",
        reason: verified.reason,
      }),
    );
    return refuse("Unauthorized", 401);
  }

  let body: Record<string, any>;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse("Malformed request body", 400);
  }

  if (body.action === "products") return partnerProducts();
  if (body.action === "checkout") return partnerCheckout(request, body);
  return refuse("Unknown action", 400);
}

/**
 * The catalogue, as CityBeat currently prices it.
 *
 * Elevate fetches this instead of keeping its own copy. A mirrored price list
 * goes stale silently and the first symptom is a rep quoting a number the
 * client is then held to.
 */
function partnerProducts() {
  return NextResponse.json({ ok: true, products: partnerSalesProducts() });
}

async function partnerCheckout(
  request: NextRequest,
  body: Record<string, any>,
) {
  const product = resolveSalesProductRequest({
    productId: body.productId,
    kind: body.kind,
    plan: body.plan,
  });
  if (!product) return refuse("Choose a valid product", 400);

  const requiresCheckout = product.billing !== "free";
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (requiresCheckout && !stripeSecretKey) {
    return refuse("Stripe configuration missing", 503, "stripe_not_configured");
  }
  const stripe = requiresCheckout
    ? new Stripe(stripeSecretKey!, { apiVersion: "2023-08-16" })
    : null;

  const businessName =
    typeof body.business?.name === "string"
      ? body.business.name.trim().slice(0, 140)
      : "";
  const contactEmail = normalizeSalesEmail(body.business?.email);
  const contactPhone =
    typeof body.business?.phone === "string"
      ? body.business.phone.trim().slice(0, 40)
      : "";
  const locale = body.locale === "es" ? "es" : "en";
  const repId =
    typeof body.rep?.id === "string" ? body.rep.id.trim().slice(0, 80) : "";
  const repEmail =
    typeof body.rep?.email === "string"
      ? body.rep.email.trim().slice(0, 160)
      : "";
  const repName =
    typeof body.rep?.name === "string"
      ? body.rep.name.trim().slice(0, 120)
      : "";
  const customDescription =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : "";
  const amount = salesProductAmount(
    product,
    body.customAmountCents ? body.customAmountCents / 100 : undefined,
  );

  if (!businessName) return refuse("Business name is required", 400);
  if (!contactEmail) return refuse("Client email is required", 400);
  if (!isValidSalesEmail(contactEmail))
    return refuse("Enter a valid client email", 400);
  if (!repId || !repEmail)
    return refuse("Partner rep identity is required", 400);
  if (amount === null)
    return refuse("Custom amount must be between $1 and $100,000", 400);
  if (product.id === "custom_one_time" && !customDescription) {
    return refuse("Describe the approved custom product", 400);
  }
  // Explicitly refused rather than ignored. Silently dropping a bypass request
  // would let Elevate believe verification was waived when it was not.
  if (body.bypassVerification === true) {
    return refuse(
      "Verification bypass is not available to partners",
      403,
      "bypass_forbidden",
    );
  }
  if (body.listingId) {
    return refuse(
      "Partners can only create new listings",
      400,
      "listing_merge_forbidden",
    );
  }
  if (product.founding && !(await foundingOfferAvailable())) {
    return refuse(
      "The Founding 100 launch offer is sold out. Please choose another plan.",
      409,
      "founding_sold_out",
    );
  }

  const directoryCategory =
    product.family === "directory"
      ? resolveDirectoryCategory({
          requestedCategory: body.directoryCategory,
          listingCategory: undefined,
        })
      : "";
  if (product.family === "directory" && !directoryCategory) {
    return refuse("Choose a directory category", 400);
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const sellerId = partnerSellerId(repId);

  if (product.id === "directory_basic_free") {
    const listingRef = adminDb.collection("directory_listings").doc();
    const listingUrl = salesDirectoryListingUrl({
      origin: appOrigin,
      locale,
      listingId: listingRef.id,
    });
    await listingRef.set({
      ...buildSalesDirectoryListingRecord({
        businessName,
        category: directoryCategory,
        contactEmail,
        contactPhone,
        locale,
        sellerUserId: sellerId,
        productId: product.id,
      }),
      partner_source: "elevate",
      partner_rep_id: repId,
      partner_rep_email: repEmail,
      partner_rep_name: repName || null,
    });
    return NextResponse.json(
      {
        ok: true,
        url: listingUrl,
        checkoutRequired: false,
        orderId: null,
        listingId: listingRef.id,
        listingUrl,
        productId: product.id,
        priceLabel: product.priceLabel,
        billing: product.billing,
      },
      { status: 201 },
    );
  }

  let orderRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const access = createSalesOrderAccess();
    orderRef = adminDb.collection("sales_orders").doc();
    const listingId = product.family === "directory" ? orderRef.id : "";

    await orderRef.set({
      ...buildSalesOrderRecord({
        product,
        amount,
        businessName,
        contactEmail,
        contactPhone,
        locale,
        sellerUserId: sellerId,
        listingId,
        directoryCategory,
        listingPreexisting: false,
        customDescription,
        tokenHash: access.tokenHash,
      }),
      // buildSalesOrderRecord sets payout_user_id from the seller. Cleared
      // here: the Elevate rep is paid by Elevate, and leaving a synthetic id
      // in this field would enter a person who is not a CityBeat user into
      // CityBeat's payout run.
      payout_user_id: null,
      partner_source: "elevate",
      partner_rep_id: repId,
      partner_rep_email: repEmail,
      partner_rep_name: repName || null,
    });

    const listingUrl = listingId
      ? salesDirectoryListingUrl({ origin: appOrigin, locale, listingId })
      : null;

    if (listingId) {
      await adminDb
        .collection("directory_listings")
        .doc(listingId)
        .set({
          ...buildSalesDirectoryListingRecord({
            businessName,
            category: directoryCategory,
            contactEmail,
            contactPhone,
            locale,
            sellerUserId: sellerId,
            productId: product.id,
            orderId: orderRef.id,
          }),
          partner_source: "elevate",
        });
    }

    const urls = salesOrderCheckoutUrls({
      origin: appOrigin,
      locale,
      orderId: orderRef.id,
      token: access.token,
      billing: product.billing === "subscription" ? "subscription" : "one_time",
    });
    const priceLabel = salesProductPriceLabel(product, amount);
    const directoryPlan = product.directoryPlanId
      ? getPlan(product.directoryPlanId)
      : null;
    const metadata: Record<string, string> = {
      ...salesOrderStripeMetadata({
        orderId: orderRef.id,
        product,
        sellerUserId: sellerId,
        contactEmail,
        businessName,
        listingId: listingId || undefined,
      }),
      // Same reasoning as the order record. Empty string rather than a
      // deleted key because the webhook reads `metadata.payout_user_id || null`
      // and Stripe metadata values must be strings.
      payout_user_id: "",
      partner_source: "elevate",
      partner_rep_id: repId,
      ...(directoryPlan
        ? {
            tier: directoryPlan.tier,
            plan: directoryPlan.id,
            founding: directoryPlan.founding ? "true" : "false",
            sponsored: directoryPlan.sponsored ? "true" : "false",
            billing_cycle: directoryPlan.interval,
            directory_category: directoryCategory,
            listing_preexisting: "false",
          }
        : {
            adType: product.intakeKind,
            description: customDescription || product.description,
          }),
    };

    const session = await stripe!.checkout.sessions.create({
      ...(product.billing === "subscription"
        ? recurringCheckoutDefaults(priceLabel, product.interval || "month")
        : oneTimeCheckoutDefaults()),
      customer_email: contactEmail,
      client_reference_id: orderRef.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            ...(product.billing === "subscription"
              ? { recurring: { interval: product.interval || "month" } }
              : {}),
            product_data: {
              name: `CityBeat ${product.shortName}: ${businessName}`,
              description: customDescription || product.description,
            },
          },
        },
      ],
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      metadata,
      ...(product.billing === "subscription"
        ? { subscription_data: { metadata } }
        : {}),
    });

    await orderRef.set(
      {
        checkout_status: "ready",
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        checkout_expires_at: session.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      url: session.url,
      checkoutRequired: true,
      orderId: orderRef.id,
      listingId: listingId || null,
      listingUrl,
      productId: product.id,
      priceLabel,
      billing: product.billing,
    });
  } catch (error: any) {
    if (orderRef) {
      await orderRef
        .set(
          {
            checkout_status: "failed",
            checkout_error: String(
              error?.message || "Could not create checkout",
            ).slice(0, 300),
            updated_at: new Date().toISOString(),
          },
          { merge: true },
        )
        .catch(() => {});
    }
    return refuse(
      error?.message || "Could not create checkout",
      Number(error?.status) || 400,
      error?.code,
    );
  }
}
