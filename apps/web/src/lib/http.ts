// Bounded outbound HTTP.
//
// Every third party we call — Anthropic, Stripe, Resend, Twilio, Facebook, an
// RSS host, a scraped page — can stop responding without closing the socket.
// Node's fetch has NO default timeout, so such a call hangs until the peer gives
// up. On a request path that pins a Cloud Run request slot; at concurrency 80 a
// single slow dependency can exhaust the instance and take the whole site down
// even though nothing about our own code is broken. Inside the Stripe webhook it
// is worse: Stripe abandons the delivery after ~30s and retries, so a hang turns
// a completed payment into an unfulfilled one.
//
// Rule: an outbound fetch in this codebase always carries a deadline.

/** Interactive paths — someone is waiting on a response. */
export const FETCH_TIMEOUT_FAST = 10_000
/** Ordinary API calls to a well-behaved provider. */
export const FETCH_TIMEOUT_MS = 15_000
/** LLM generations, which legitimately take a while. */
export const FETCH_TIMEOUT_LLM = 60_000

/**
 * fetch() with a hard deadline. An explicit `signal` in `init` wins, so callers
 * that already manage cancellation are untouched. A timeout surfaces as a
 * rejection (`TimeoutError`), i.e. the same shape as a network failure, so
 * existing try/catch handling stays correct.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) })
}
