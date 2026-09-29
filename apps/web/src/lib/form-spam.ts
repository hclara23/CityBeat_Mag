// Bot detection for public enquiry forms. Pure (no I/O) so the rules are
// unit-tested against the real junk that reached the leads inbox.
//
// The ad-enquiry form on /ads/[product] collected 53 rows in September 2026,
// every one of them from the same botnet: each free-text field filled with a
// single random mixed-case token ("hxyTSzLnRcbFPntyRVKD", "OyUEWCHYqVlYbPqeNMBi")
// and a real person's email address, usually a Gmail address salted with dots
// ("ver.a.eb.f.r.or.q.850@gmail.com"). The rate limit never tripped because the
// submissions arrive from many IPs, a few a day. None were legitimate.
//
// Two independent signals, either sufficient:
//   1. A honeypot field a person never sees and a form-filling bot fills.
//   2. EVERY non-empty free-text field is a random token. Requiring all of them
//      keeps a real enquiry safe even if one field happens to look odd — a
//      human who types a CamelCase campaign name still writes a sentence of
//      notes, or leaves notes empty with a campaign name made of real words.

/**
 * A single run of 10–40 letters, no spaces, that mixes case (3+ flips) AND reads
 * like no CamelCase phrase would. A real CamelCase name ("ElPasoFallFest",
 * "McDonaldsElPaso", "UTEPHomecoming") splits into pronounceable words of mostly
 * 3+ letters with sparse capitals. The bot's tokens fail at least one of:
 *   - a consonant run of 5+ inside one word ("cqluqtsf")
 *   - dense capitals (≥30% of the token, or ≥20% with adjacent capitals)
 *   - three or more 1–2 letter "words" once split at the capitals
 * Tuned against all 106 junk tokens (all caught) and a set of real CamelCase
 * names (none caught) — see form-spam.test.ts.
 */
export function looksLikeRandomToken(value: unknown): boolean {
  const s = String(value ?? '').trim()
  if (!/^[A-Za-z]{10,40}$/.test(s)) return false
  const flips = (s.match(/[a-z](?=[A-Z])|[A-Z](?=[a-z])/g) || []).length
  if (flips < 3) return false
  const density = (s.slice(1).match(/[A-Z]/g) || []).length / s.length
  const upperRun = Math.max(0, ...(s.slice(1).match(/[A-Z]+/g) || []).map((r) => r.length))
  const words = s.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+/g) || []
  const consonantRun = Math.max(
    0,
    ...words.flatMap((w) => w.toLowerCase().match(/[^aeiouy]+/g) || []).map((r) => r.length)
  )
  const shortWords = words.filter((w) => w.length <= 2).length
  return consonantRun >= 5 || density >= 0.3 || (upperRun >= 2 && density >= 0.2) || shortWords >= 3
}

export function isBotSubmission(input: { honeypot?: unknown; fields: unknown[] }): boolean {
  if (String(input.honeypot ?? '').trim() !== '') return true
  const filled = input.fields.map((f) => String(f ?? '').trim()).filter(Boolean)
  return filled.length > 0 && filled.every(looksLikeRandomToken)
}
