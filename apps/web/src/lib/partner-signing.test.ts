import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  SIGNATURE_TOLERANCE_SECONDS,
  verifyPartnerRequest,
} from "./partner-signing";

const SECRET = "test-partner-secret-value";
const NOW = 1_800_000_000;

/**
 * Reimplements Elevate's signer rather than importing it — the two apps live
 * in separate repositories, so this test is what proves the two independent
 * implementations still agree. If Elevate changes its scheme, this fails.
 */
function sign(body: string, secret = SECRET, timestamp = NOW) {
  return {
    "x-elevate-timestamp": String(timestamp),
    "x-elevate-signature": createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex"),
  };
}

test("accepts a request signed by the partner", () => {
  const body = JSON.stringify({
    action: "checkout",
    productId: "ad_sponsored_story",
  });
  assert.equal(verifyPartnerRequest(body, sign(body), SECRET, NOW).valid, true);
});

test("rejects a body edited after signing", () => {
  const body = JSON.stringify({ action: "checkout", customAmountCents: 5000 });
  const headers = sign(body);
  const tampered = JSON.stringify({ action: "checkout", customAmountCents: 1 });
  const result = verifyPartnerRequest(tampered, headers, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("rejects a signature made with a different secret", () => {
  const body = '{"action":"products"}';
  const result = verifyPartnerRequest(
    body,
    sign(body, "wrong-secret"),
    SECRET,
    NOW,
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("rejects a replayed request from outside the window", () => {
  const body = '{"action":"products"}';
  const headers = sign(body, SECRET, NOW - SIGNATURE_TOLERANCE_SECONDS - 1);
  const result = verifyPartnerRequest(body, headers, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "stale");
});

test("accepts a request at the edge of the freshness window", () => {
  const body = '{"action":"products"}';
  const headers = sign(body, SECRET, NOW - SIGNATURE_TOLERANCE_SECONDS);
  assert.equal(verifyPartnerRequest(body, headers, SECRET, NOW).valid, true);
});

test("rejects a timestamp far in the future", () => {
  const body = '{"action":"products"}';
  const headers = sign(body, SECRET, NOW + SIGNATURE_TOLERANCE_SECONDS + 1);
  const result = verifyPartnerRequest(body, headers, SECRET, NOW);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "stale");
});

test("rejects a replay whose timestamp was edited to look fresh", () => {
  const body = '{"action":"products"}';
  const headers = sign(body, SECRET, NOW - 10_000);
  // The signature covers the timestamp, so moving it invalidates the whole
  // request rather than buying the attacker a fresh window.
  const result = verifyPartnerRequest(
    body,
    { ...headers, "x-elevate-timestamp": String(NOW) },
    SECRET,
    NOW,
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("rejects missing headers", () => {
  const body = '{"action":"products"}';
  assert.equal(
    verifyPartnerRequest(body, {}, SECRET, NOW).reason,
    "missing_headers",
  );
  assert.equal(
    verifyPartnerRequest(
      body,
      { "x-elevate-timestamp": String(NOW) },
      SECRET,
      NOW,
    ).reason,
    "missing_headers",
  );
});

test("rejects a non-numeric timestamp", () => {
  const body = '{"action":"products"}';
  const result = verifyPartnerRequest(
    body,
    { "x-elevate-timestamp": "now", "x-elevate-signature": "a".repeat(64) },
    SECRET,
    NOW,
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_timestamp");
});

test("rejects a wrong-length signature without throwing", () => {
  // timingSafeEqual throws on mismatched buffer lengths; the length guard has
  // to run first or a short signature becomes a 500 instead of a 401.
  const body = '{"action":"products"}';
  const result = verifyPartnerRequest(
    body,
    { "x-elevate-timestamp": String(NOW), "x-elevate-signature": "abc" },
    SECRET,
    NOW,
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "bad_signature");
});

test("an empty secret does not validate an unsigned request", () => {
  const body = '{"action":"products"}';
  const result = verifyPartnerRequest(
    body,
    { "x-elevate-timestamp": String(NOW), "x-elevate-signature": "" },
    "",
    NOW,
  );
  assert.equal(result.valid, false);
});
