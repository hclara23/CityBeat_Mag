import {
  SALES_PRODUCTS,
  SALES_PRODUCT_ORDER,
  type SalesProductFamily,
} from "./sales-products";

export interface PartnerSalesProduct {
  id: string;
  name: string;
  description: string;
  salesAngle: string;
  priceLabel: string;
  amountCents?: number;
  recurring: boolean;
  family: SalesProductFamily;
  founding: boolean;
  requiresAmount: boolean;
}

/**
 * The products an authenticated partner may sell.
 *
 * This is projected from CityBeat's canonical Sales Desk catalogue on every
 * request. Prices are never duplicated in Elevate, so a CityBeat price change
 * reaches representatives immediately. Basic Free is included as a listing
 * handoff rather than pretending it has a payment step.
 */
export function partnerSalesProducts(): PartnerSalesProduct[] {
  return SALES_PRODUCT_ORDER.map((id) => SALES_PRODUCTS[id]).map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    salesAngle: product.salesAngle,
    priceLabel: product.priceLabel,
    amountCents: product.unitAmount ?? undefined,
    recurring: product.billing === "subscription",
    family: product.family,
    founding: Boolean(product.founding),
    requiresAmount: product.id === "custom_one_time",
  }));
}
