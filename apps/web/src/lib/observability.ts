import { Langfuse } from 'langfuse'
import { recordAiCall } from './ai-audit-server'

// LLM observability via Langfuse. FULLY env-gated: with no LANGFUSE_* keys this is
// a no-op that never throws, so it cannot affect any AI feature. Turn it on by
// setting these on the server (Cloud Run):
//   LANGFUSE_PUBLIC_KEY  = pk-lf-…
//   LANGFUSE_SECRET_KEY  = sk-lf-…
//   LANGFUSE_BASE_URL    = https://us.cloud.langfuse.com  (US cloud; else eu / self-host)

let cached: Langfuse | null | undefined // undefined = uninitialized, null = disabled

function getClient(): Langfuse | null {
  if (cached !== undefined) return cached
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY
  if (!publicKey || !secretKey) {
    cached = null
    return cached
  }
  try {
    cached = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
    })
  } catch {
    cached = null
  }
  return cached
}

export function observabilityEnabled(): boolean {
  return getClient() !== null
}

// Record one Anthropic Messages call as a Langfuse generation. Pass the request
// input (prompt/messages) and the parsed Anthropic response `data` — the model,
// output text, and token usage are read straight off it. Awaits the flush so
// serverless (Cloud Run) doesn't drop the event, but swallows every error.
export async function traceClaude(
  name: string,
  input: unknown,
  data: any,
  metadata?: Record<string, unknown>,
  startTime?: Date,
  opts?: { ok?: boolean; error?: string | null },
): Promise<void> {
  // FIRST-PARTY AUDIT (always on, independent of Langfuse). Every Anthropic call
  // site in the app already funnels through this function, so writing the durable
  // record here gives complete coverage — and it must not depend on a vendor key
  // being set. Awaited rather than fire-and-forget (Cloud Run can freeze CPU once
  // a response is returned, and an audit log with silent holes is not an audit
  // log), but time-boxed so a slow Firestore can never hang a user request.
  await Promise.race([
    recordAiCall({
      purpose: name,
      promptInput: input,
      responseData: data,
      metadata: metadata || null,
      startTime: startTime || null,
      // Never derive success from truthiness — a parsed error body is truthy too.
      ok: opts?.ok !== false,
      error: opts?.error ?? (data?.error ? String(data.error?.type || data.error) : null),
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ])

  const lf = getClient()
  if (!lf) return
  try {
    const output = data?.content?.[0]?.text ?? data ?? null
    const usage = data?.usage
      ? { input: data.usage.input_tokens, output: data.usage.output_tokens, unit: 'TOKENS' as const }
      : undefined
    lf.trace({ name, metadata }).generation({
      name,
      model: data?.model || 'claude',
      input,
      output,
      usage,
      startTime,
      endTime: new Date(),
      metadata,
    })
    await lf.flushAsync()
  } catch {
    /* observability must never break the app */
  }
}

/**
 * Audit a FAILED generation. Every Anthropic call site returns early on a non-OK
 * response, so without this the audit log would show a clean gap exactly when the
 * model was refusing or down — the one failure mode an audit log must not have.
 */
export async function traceClaudeFailure(
  name: string,
  input: unknown,
  error: string,
  metadata?: Record<string, unknown>,
  startTime?: Date,
): Promise<void> {
  await traceClaude(name, input, null, metadata, startTime, { ok: false, error })
}
