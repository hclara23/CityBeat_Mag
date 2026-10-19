// Read-only production analytics verification. Never prints or persists tokens.
import { execFileSync } from 'node:child_process'
const account = process.argv[2]
if (!account || !/^[a-zA-Z0-9@._+-]+$/.test(account)) {
  throw new Error('Usage: node scripts/audit-analytics-readonly.mjs GOOGLE_ACCOUNT_EMAIL')
}
function gcloud(args) {
  if (args.some(arg => !/^[a-zA-Z0-9@._:/=-]+$/.test(arg))) throw new Error('Invalid CLI argument')
  return execFileSync('gcloud.cmd', [...args, `--account=${account}`], {
    encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000,
  }).trim()
}
const service = JSON.parse(gcloud(['run', 'services', 'describe', 'citybeat-web', '--project=kerstenblueprint', '--region=us-central1', '--format=json']))
const env = Object.fromEntries(service.spec.template.spec.containers[0].env.filter(x => x.value !== undefined).map(x => [x.name, x.value]))
const tokenRef = service.spec.template.spec.containers[0].env.find(x => x.name === 'CLOUDFLARE_ANALYTICS_API_TOKEN')?.valueFrom?.secretKeyRef
if (tokenRef) {
  try { env.CLOUDFLARE_ANALYTICS_API_TOKEN = gcloud(['secrets', 'versions', 'access', tokenRef.key, `--secret=${tokenRef.name}`, '--project=kerstenblueprint']) }
  catch { console.log('Cloudflare: configured secret could not be read with this operator account.') }
}
console.log('Revision:', service.status.latestReadyRevisionName)
try {
  const token = gcloud(['auth', 'print-access-token', `--impersonate-service-account=${service.spec.template.spec.serviceAccountName}`, '--scopes=https://www.googleapis.com/auth/analytics.readonly'])
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: '29daysAgo', endDate: 'today' }], metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }] }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await response.json()
  console.log(JSON.stringify({ provider: 'google', http: response.status, status: data.error?.status, metrics: data.rows?.[0]?.metricValues }))
} catch (error) {
  console.log('Google: read-only credential/report check unavailable; no zero-traffic inference.')
  console.log(String(error.stderr || '').split('\n').filter(x => /ERROR:/.test(x)).slice(0,1).join('\n'))
}
if (env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($account: String!, $site: String!, $start: DateTime!, $end: DateTime!) { viewer { accounts(filter: { accountTag: $account }) { rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $site, datetime_geq: $start, datetime_leq: $end }) { count } } } }', variables: { account: env.CLOUDFLARE_ACCOUNT_ID, site: env.CLOUDFLARE_WEB_ANALYTICS_SITE_TAG, start: new Date(Date.now() - 29 * 86400000).toISOString(), end: new Date().toISOString() } }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await response.json()
  console.log(JSON.stringify({ provider: 'cloudflare', http: response.status, errors: data.errors?.map(x => x.message), counts: data.data?.viewer?.accounts?.map(x => x.rumPageloadEventsAdaptiveGroups) }))
} else console.log('Cloudflare: reporting token unavailable to this check.')
