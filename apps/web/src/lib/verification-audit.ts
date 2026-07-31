// Salesperson verification bypass + immutable audit + signed claim-acceptance
// token. Pure, testable logic for Directory Owner Platform rollout step 3.
//
// The bypass lets an AUTHORIZED sales/developer rep attest that a newly created
// listing is a real business (they were physically there, or personally know the
// owner) — removing the second business-verification challenge, NOT account
// authentication. Every use writes an immutable audit row, and the customer
// still has to sign in with the exact recorded email and present a signed,
// expiring, single-use token to accept ownership.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { normalizeSalesEmail } from './sales-checkout'

export const ATTESTATION_METHODS = ['in_person_at_business', 'personally_knows_owner'] as const
export type AttestationMethod = (typeof ATTESTATION_METHODS)[number]

export function normalizeAttestationMethod(value: unknown): AttestationMethod | null {
  return (ATTESTATION_METHODS as readonly string[]).includes(value as string)
    ? (value as AttestationMethod)
    : null
}

// --- Bypass request validation (server-side; the caller has already confirmed
// the rep's role and normalized the customer email) ---

export type BypassValidation =
  | { ok: true; method: AttestationMethod; note: string }
  | { ok: false; error: string }

export function validateBypass(input: {
  attestationMethod: unknown
  attestationAccepted: unknown
  customerEmail: string
  attestationNote?: unknown
}): BypassValidation {
  const method = normalizeAttestationMethod(input.attestationMethod)
  if (!method) {
    return { ok: false, error: 'Choose how you verified this business (in person or you know the owner).' }
  }
  if (input.attestationAccepted !== true) {
    return { ok: false, error: 'Confirm you are authorized to bypass verification for this business.' }
  }
  if (!input.customerEmail) {
    return { ok: false, error: "The customer's exact email is required to bypass verification." }
  }
  const note = typeof input.attestationNote === 'string' ? input.attestationNote.trim().slice(0, 500) : ''
  return { ok: true, method, note }
}

// --- Audit record ---

// A salt keeps request-IP hashes non-reversible (the IPv4 space is small enough
// to brute-force a bare sha256). Reuses an already-present server secret.
const IP_HASH_SALT = process.env.AUDIT_IP_SALT || process.env.CRON_SECRET || 'citybeat-verification-audit'

export function hashRequestIp(ip: string | null | undefined): string {
  return createHash('sha256').update(`${IP_HASH_SALT}:${ip || 'unknown'}`).digest('hex')
}

export function summarizeUserAgent(ua: string | null | undefined): string {
  if (typeof ua !== 'string' || !ua.trim()) return 'unknown'
  return ua.replace(/\s+/g, ' ').trim().slice(0, 200)
}

export type VerificationAuditRecord = {
  listing_id: string
  salesperson_id: string
  salesperson_email: string
  verification_path: 'salesperson_attestation'
  attestation_method: AttestationMethod
  attestation_note: string
  customer_email_normalized: string
  created_at: string
  request_ip_hash: string
  user_agent_summary: string
}

export function buildVerificationAuditRecord(args: {
  listingId: string
  salespersonId: string
  salespersonEmail: string
  method: AttestationMethod
  note: string
  customerEmail: string
  ip: string | null | undefined
  userAgent: string | null | undefined
  now: string
}): VerificationAuditRecord {
  return {
    listing_id: args.listingId,
    salesperson_id: args.salespersonId,
    salesperson_email: normalizeSalesEmail(args.salespersonEmail || '') || 'unknown',
    verification_path: 'salesperson_attestation',
    attestation_method: args.method,
    attestation_note: args.note,
    customer_email_normalized: normalizeSalesEmail(args.customerEmail || ''),
    created_at: args.now,
    request_ip_hash: hashRequestIp(args.ip),
    user_agent_summary: summarizeUserAgent(args.userAgent),
  }
}

// --- Signed, expiring, single-purpose claim token ---
// Modeled on the vetted sales-orders access token: 32 random bytes; only the
// sha256 hash is ever stored; verified with a constant-time compare.

export const CLAIM_TOKEN_TTL_DAYS = 14

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function mintClaimToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashClaimToken(token) }
}

export function claimTokenMatches(token: unknown, expectedHash: unknown): boolean {
  if (typeof token !== 'string' || !token) return false
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) return false
  const actual = Buffer.from(hashClaimToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function claimTokenExpiresAt(nowMs: number): string {
  return new Date(nowMs + CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function claimTokenExpired(expiresAt: unknown, nowMs: number): boolean {
  if (typeof expiresAt !== 'string') return true
  const ms = Date.parse(expiresAt)
  return !Number.isFinite(ms) || nowMs > ms
}

// --- Claim acceptance decision ---

export type AcceptanceListing = {
  claim_status?: string | null
  owner_id?: string | null
  contact_email?: string | null
  verification_path?: string | null
  claim_token_hash?: string | null
  claim_token_expires_at?: string | null
  claim_token_consumed_at?: string | null
  requested_product_id?: string | null
}

export type AcceptanceErrorCode =
  | 'not_bypass'
  | 'consumed'
  | 'owned'
  | 'invalid_token'
  | 'expired'
  | 'wrong_email'

export type AcceptanceResult =
  | { ok: false; status: number; error: string; code: AcceptanceErrorCode }
  | { ok: true; isPaid: boolean }

// The single authorization point for accepting a bypassed listing. Requires a
// pre-attested listing, an unused/unexpired token that matches, and the
// signed-in account's email to equal the recorded customer email. Ordering
// matters: report "already used"/"already claimed" before token validity so a
// consumed link never looks merely invalid.
export function evaluateClaimAcceptance(input: {
  token: unknown
  userEmail: string | null | undefined
  listing: AcceptanceListing
  nowMs: number
}): AcceptanceResult {
  const l = input.listing
  if (l.verification_path !== 'salesperson_attestation' || !l.claim_token_hash) {
    return { ok: false, status: 400, code: 'not_bypass', error: 'This listing is not available for direct acceptance.' }
  }
  if (l.claim_token_consumed_at) {
    return { ok: false, status: 409, code: 'consumed', error: 'This claim link has already been used.' }
  }
  if (l.owner_id) {
    return { ok: false, status: 409, code: 'owned', error: 'This listing has already been claimed.' }
  }
  if (!claimTokenMatches(input.token, l.claim_token_hash)) {
    return { ok: false, status: 403, code: 'invalid_token', error: 'This claim link is invalid.' }
  }
  if (claimTokenExpired(l.claim_token_expires_at, input.nowMs)) {
    return { ok: false, status: 403, code: 'expired', error: 'This claim link has expired.' }
  }
  const email = normalizeSalesEmail(input.userEmail || '')
  const recorded = normalizeSalesEmail(l.contact_email || '')
  if (!email || !recorded || email !== recorded) {
    return {
      ok: false,
      status: 403,
      code: 'wrong_email',
      error: 'Sign in with the exact email your CityBeat rep recorded to accept this listing.',
    }
  }
  const isPaid = Boolean(l.requested_product_id && l.requested_product_id !== 'directory_basic_free')
  return { ok: true, isPaid }
}

// Fields the bypass writes onto the directory_listings doc. Non-sensitive
// markers only — the note, IP hash, and salesperson id live exclusively in
// directory_verification_audits and must never be copied here or exposed
// publicly.
export const BYPASS_LISTING_FIELDS = [
  'verification_path',
  'claim_token_hash',
  'claim_token_expires_at',
  'claim_token_consumed_at',
] as const
