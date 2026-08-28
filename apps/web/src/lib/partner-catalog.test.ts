import assert from "node:assert/strict";
import test from "node:test";
import { partnerSalesProducts } from "./partner-catalog";
import { SALES_PRODUCTS, SALES_PRODUCT_ORDER } from "./sales-products";

test("publishes every CityBeat Sales Desk product to partners", () => {
  const products = partnerSalesProducts();

  assert.equal(products.length, 14);
  assert.deepEqual(
    products.map((product) => product.id),
    SALES_PRODUCT_ORDER,
  );
  assert.equal(
    products.find((product) => product.id === "directory_basic_free")
      ?.amountCents,
    0,
  );
});

test("projects prices and recurring terms from the canonical catalogue", () => {
  for (const product of partnerSalesProducts()) {
    const canonical = SALES_PRODUCTS[product.id as keyof typeof SALES_PRODUCTS];
    assert.equal(product.priceLabel, canonical.priceLabel);
    assert.equal(product.amountCents, canonical.unitAmount ?? undefined);
    assert.equal(product.recurring, canonical.billing === "subscription");
    assert.equal(product.family, canonical.family);
  }
});

test("keeps the manager-approved custom quote sellable without inventing a price", () => {
  const custom = partnerSalesProducts().find(
    (product) => product.id === "custom_one_time",
  );
  assert.ok(custom);
  assert.equal(custom.requiresAmount, true);
  assert.equal(custom.amountCents, undefined);
  assert.equal(custom.recurring, false);
  assert.match(custom.salesAngle, /custom package/i);
});

test("labels limited Founding plans so Elevate can explain scarcity honestly", () => {
  const founding = partnerSalesProducts().filter((product) => product.founding);
  assert.deepEqual(
    founding.map((product) => product.id),
    ["directory_founding_annual", "directory_founding_monthly"],
  );
});
