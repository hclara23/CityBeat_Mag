import { NextResponse } from 'next/server'
import { checkStripe } from '@/lib/stripe-health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// "Can this business take money right now?" — 200 yes, 503 no.
//
// This exists because the answer was no for two days and nothing said so. The
// live Stripe secret key had been rolled, so Stripe rejected every call with
// "Expired API Key provided": no checkout session could be created, no billing
// portal opened, no subscription retrieved, no commission transferred. The site
// itself was perfect throughout — news, directory, search, sign-in, and the
// health check all green — because none of that touches Stripe. The only reason
// it surfaced at all is that a reconciliation cron happened to call Stripe and
// was quietly returning 500s that nothing logged.
//
// Separate from /api/health on purpose. That endpoint answers "is the site up",
// and it is also the deploy pipeline's smoke test — folding payments into it
// would block every deploy while payments are down, including the one that fixes
// them. Two questions, two urgencies, two probes.
//
// Point an uptime check here (from PowerShell, never Git Bash — MSYS mangles the
// --path argument):
//   gcloud monitoring uptime create citybeat-payments \
//     --resource-type=uptime-url --resource-labels=host=citybeatmag.co \
//     --path=/api/health/payments --period=15
export async function GET() {
  // A probe that threw has NOT established that we can take money, so it must
  // not answer that we can. checkStripe already swallows reachability problems
  // and returns ok:true for them, so anything reaching this catch is a fault in
  // the check itself — which is the same blind spot as a missing key.
  const stripe = await checkStripe().catch((error: any) => ({
    ok: false,
    error: `probe_failed:${String(error?.message || 'unknown').slice(0, 120)}`,
    checked: false,
  }))

  return NextResponse.json(
    {
      status: stripe.ok ? 'ok' : 'payments_down',
      // Deliberately narrow: only an AUTHENTICATION failure counts. A Stripe
      // outage or a network blip is not our configuration being broken and must
      // not page anyone at 3am — it is reported in `detail` and still returns 200.
      can_take_payments: stripe.ok,
      detail: stripe.error,
      revision: process.env.K_REVISION || null,
      timestamp: new Date().toISOString(),
      // The remediation must name the right failure: "the key is being rejected"
      // sends an operator to roll a key that is not there at all, and rolling it
      // would not put it back on the service.
      ...(stripe.ok
        ? {}
        : {
            remediation: String(stripe.error || '').startsWith('missing_key')
              ? 'STRIPE_SECRET_KEY is not set on the Cloud Run service, so no card can be charged. Set it: gcloud run services update citybeat-web --region us-central1 --project kerstenblueprint --update-env-vars STRIPE_SECRET_KEY=<key>'
              : String(stripe.error || '').startsWith('probe_failed')
                ? 'The payments health probe itself failed, so whether we can take money is UNKNOWN. Check the service logs for this revision before assuming either answer.'
                : 'The Stripe secret key on Cloud Run is being rejected. Roll a new one in the Stripe dashboard, then: gcloud run services update citybeat-web --region us-central1 --project kerstenblueprint --update-env-vars STRIPE_SECRET_KEY=<new key>',
          }),
    },
    { status: stripe.ok ? 200 : 503 }
  )
}
