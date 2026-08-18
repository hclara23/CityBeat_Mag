import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifies server-to-server requests from a partner app (currently Elevate El
 * Paso, whose reps sell CityBeat listings from their own dashboard).
 *
 * This is intentionally a copy of the signing scheme rather than a shared
 * package: CityBeat and Elevate are separate repositories with separate deploy
 * pipelines, and a shared library between them would mean neither can be
 * released without the other. The duplicated surface is small and frozen —
 * thirty lines of HMAC with a test on both sides.
 *
 *   signature = HMAC-SHA256(secret, `${timestamp}.${body}`)
 *
 * The timestamp is signed rather than sitting beside the signature. If it were
 * outside the payload an attacker could replay a captured request forever by
 * editing the clock value; signing it means the freshness window actually
 * bounds replay.
 *
 * A valid signature proves the REQUEST came from Elevate's server. It is not a
 * user credential: CityBeat still decides what a partner is allowed to do, and
 * this route deliberately allows less than a logged-in CityBeat salesperson.
 */

/** How far apart the two servers' clocks may be, in seconds. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type PartnerVerifyFailure =
  | "missing_headers"
  | "bad_timestamp"
  | "stale"
  | "bad_signature";

export interface PartnerVerifyResult {
  valid: boolean;
  reason?: PartnerVerifyFailure;
}

export function verifyPartnerRequest(
  body: string,
  headers: Record<string, string | null | undefined>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): PartnerVerifyResult {
  const timestampRaw = headers["x-elevate-timestamp"];
  const provided = headers["x-elevate-signature"];
  if (!timestampRaw || !provided)
    return { valid: false, reason: "missing_headers" };

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp)) {
    return { valid: false, reason: "bad_timestamp" };
  }
  // Absolute difference: a timestamp far in the FUTURE is as suspicious as a
  // stale one, and checking only the past would let a forged future stamp stay
  // valid indefinitely.
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: "stale" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  // Constant-time compare. A plain === leaks how many leading characters
  // matched via timing, which is enough to forge a signature byte by byte.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return { valid: false, reason: "bad_signature" };
  return timingSafeEqual(a, b)
    ? { valid: true }
    : { valid: false, reason: "bad_signature" };
}
