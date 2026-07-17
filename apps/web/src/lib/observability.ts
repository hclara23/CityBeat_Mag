import { Langfuse } from 'langfuse'

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
): Promise<void> {
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
