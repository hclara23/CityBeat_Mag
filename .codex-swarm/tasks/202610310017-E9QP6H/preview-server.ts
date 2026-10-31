import { createServer, request as proxyRequest } from 'node:http'
import { createServer as grpcServer } from 'node:http2'
import { portfolioHarness } from '../../../apps/web/src/lib/property-portfolio-test-harness'

// All database, authentication, card, and mutation state is in memory. The
// actual Next frontend runs separately against the loopback Firestore stub.
async function main() {
  const h = portfolioHarness()
  await h.post({ action: 'claim', role: 'Fixture director', evidence: 'Isolated local test of corporate authorization.', authorized: true })
  h.setStaff(true)
  await h.admin({ kind: 'claim', id: 'rpm-living_corporate', approved: true, authority_checked: true, note: 'Isolated fixture authorization; no real company access granted.' })
  h.setStaff(false)
  await h.post({ action: 'checkout', recurring_consent: true, monthly_cents: 9990 })
  await h.event(h.completeCheckout())
  const grpc = grpcServer()
  grpc.on('stream', stream => { stream.respond({ ':status': 200, 'content-type': 'application/grpc', 'grpc-status': '5', 'grpc-message': 'Isolated preview: production data unavailable' }); stream.end() })
  grpc.listen(8765, '127.0.0.1')
  createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://127.0.0.1:3013').pathname
      if (path.startsWith('/api/')) {
        let response: Response
        const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
        if (path === '/api/property-management/register') {
          if (req.method === 'POST') response = await h.register(body)
          else { const data = h.records.get('property_company_claims/new_company_corporate'); response = Response.json({ request: data ? { status: data.status, company_id: data.company_id, name: data.proposed_company?.name } : null }) }
        } else if (/^\/api\/property-management\/[a-z0-9-]+$/.test(path)) {
          const company = path.split('/').pop()!
          response = req.method === 'POST' ? await h.post(body, company) : await h.get(company)
        } else response = Response.json({})
        res.writeHead(response.status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-citybeat-fixture': 'isolated-local-only' }); res.end(await response.text()); return
      }
      const upstream = proxyRequest({ hostname: '127.0.0.1', port: 3012, path: req.url, method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:3012', 'accept-encoding': 'identity' } }, incoming => { res.writeHead(incoming.statusCode || 502, incoming.headers); incoming.pipe(res) })
      upstream.on('error', () => { res.writeHead(502); res.end('Local Next preview not ready') }); req.pipe(upstream)
    } catch (error) { res.writeHead(500); res.end(String(error)) }
  }).listen(3013, '127.0.0.1', () => console.log('Isolated portfolio preview: http://127.0.0.1:3013/en/property-management'))
}
void main()
