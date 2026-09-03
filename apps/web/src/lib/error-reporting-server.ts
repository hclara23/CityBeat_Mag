import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ERROR_COLLECTION, normalizeErrorInput, type ErrorInput } from './error-reporting'
import { reportFailure } from './alerts'
import { checkRateLimit } from './auth-security'

// Firestore side of self-reporting bugs.
//
// One document PER FINGERPRINT, not per occurrence. A deploy that breaks a
// component throws the same error for every visitor; storing each one would cost
// a fortune and bury the signal. The row's `count` climbs and `last_seen_at`
// moves — which is also what an operator needs to triage: "started 15:04, hit
// 812 people, on these 3 routes".
//
// Contention: for client errors the fingerprint deliberately excludes the route,
// so a broken deploy funnels EVERY visitor onto one document. A read-modify-write
// transaction there would collide constantly (Firestore sustains ~1 write/sec/doc)
// and retry-storm. So this uses create()-then-increment instead: no reads, no
// transaction, and ALREADY_EXISTS is itself the race-free answer to "is this new?".
//
// Alerting is deliberately stingy, because the intake is public and anyone can
// mint a fingerprint:
//   • server/cron/webhook errors (first-party, trusted) alert on first sight
//   • client errors must be CORROBORATED — a single anonymous report cannot page
//     anyone; the alert waits until the same fingerprint has been seen by enough
//     independent occurrences to be real
//   • the email bucket is keyed by severity so a flood of low-severity noise
//     cannot crowd out a critical alert

export const CLIENT_ALERT_THRESHOLD = 10

/** Global ceiling on NEW fingerprints/hour — the last line of defence against a
 *  spoofed-IP flood filling the console with junk documents. */
const GLOBAL_NEW_FINGERPRINT_CAP = 200

export interface RecordedError {
  fingerprint: string
  isNew: boolean
  count: number
}

export async function recordError(
  raw: Partial<ErrorInput> & { source: ErrorInput['source'] }
): Promise<RecordedError | null> {
  // Stamp the deploy server-side from K_REVISION, which Cloud Run injects into
  // every revision automatically. The client cannot supply this reliably
  // (NEXT_PUBLIC_* is inlined at build time and would need a pipeline change),
  // and a client-supplied release would be attacker-controlled anyway. This makes
  // "did this start after the 15:04 deploy?" answerable.
  const norm = normalizeErrorInput({ ...raw, release: raw.release || process.env.K_REVISION || null })
  if (!norm) return null // known noise

  const ref = adminDb.collection(ERROR_COLLECTION).doc(norm.fingerprint)
  const trusted = norm.source !== 'client'
  let isNew = false
  let didRegress = false
  let count = 1

  try {
    // create() succeeds exactly once per fingerprint, across any number of
    // concurrent writers — this IS the new-vs-existing test, race-free.
    await ref.create({
      fingerprint: norm.fingerprint,
      message: norm.message,
      stack: norm.stack,
      source: norm.source,
      severity: norm.severity,
      routes: norm.route ? [norm.route] : [],
      releases: norm.release ? [norm.release] : [],
      sample_user_agent: norm.user_agent,
      sample_extra: norm.extra,
      count: 1,
      status: 'open',
      first_seen_at: FieldValue.serverTimestamp(),
      last_seen_at: FieldValue.serverTimestamp(),
    })
    isNew = true
  } catch {
    // Already exists → increment. No read, so no contention beyond the write.
    try {
      const snap = await ref.get()
      const data = (snap.data() || {}) as any
      count = (Number(data.count) || 0) + 1
      // A resolved bug that recurs must reopen itself and say so.
      didRegress = data.status === 'resolved'
      await ref.set(
        {
          count: FieldValue.increment(1),
          last_seen_at: FieldValue.serverTimestamp(),
          ...(norm.stack ? { stack: norm.stack } : {}),
          // Bounded fan-out: an issue on 200 routes doesn't need 200 stored.
          ...(norm.route && (data.routes || []).length < 12 ? { routes: FieldValue.arrayUnion(norm.route) } : {}),
          ...(norm.release && (data.releases || []).length < 12
            ? { releases: FieldValue.arrayUnion(norm.release) }
            : {}),
          ...(didRegress ? { status: 'regressed', regressed_at: FieldValue.serverTimestamp() } : {}),
        },
        { merge: true }
      )
    } catch {
      return null
    }
  }

  // A brand-new fingerprint from an untrusted source consumes global novelty
  // budget; past the cap we keep counting but stop creating alert pressure.
  if (isNew && !trusted) {
    const budget = await checkRateLimit('telemetry-error:new-fingerprints', {
      max: GLOBAL_NEW_FINGERPRINT_CAP,
      windowMs: 60 * 60 * 1000,
    }).catch(() => ({ ok: true }) as any)
    if (!budget.ok) return { fingerprint: norm.fingerprint, isNew, count }
  }

  // Who deserves an email:
  //   trusted source  → first sight (a cron failing once matters)
  //   client source   → only once corroborated, so one anonymous POST can't page
  //   regression      → always (a fixed bug came back)
  const shouldAlert = trusted ? isNew || didRegress : didRegress || count === CLIENT_ALERT_THRESHOLD

  if (shouldAlert) {
    await reportFailure(
      `bug:${norm.source}`,
      new Error(norm.message),
      {
        fingerprint: norm.fingerprint,
        severity: norm.severity,
        route: norm.route,
        release: norm.release,
        occurrences: count,
        ...(didRegress ? { regressed: true } : {}),
      },
      {
        // Client bugs never pin a health source to "failing" — nothing ever
        // reports that source healthy again.
        skipHealth: !trusted,
        // Severity-keyed bucket: low-severity noise cannot exhaust the budget a
        // critical alert needs.
        alertKey: `bug:${norm.source}:${norm.severity}`,
      }
    ).catch(() => {})
  }

  return { fingerprint: norm.fingerprint, isNew, count }
}
