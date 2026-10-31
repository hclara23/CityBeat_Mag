/** Isolated UI exercise: real claim UI/routes, in-memory DB and SMS sink only.
 * Run: node --import tsx scripts/preview-apartment-claims.ts
 * This server binds localhost; it is never included in the Next application.
 */
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { harness } from '../apps/web/src/lib/apartment-claim-test-harness'
import { randomInt } from 'node:crypto'
import { sendSms, smsConfigured } from '../apps/web/src/lib/sms'

async function main() {
  const live = process.env.CITYBEAT_LIVE_MOCK_SMS === 'editor-approved-two-texts'
  if (live && !smsConfigured()) throw new Error('Live mock requires configured Twilio credentials')
  // Default to one text per process. Never restart to replenish a user's allowance.
  const sendLimit = process.env.CITYBEAT_MOCK_SEND_LIMIT === '2' ? 2 : 1
  let attempts = 0
  const h = harness(live ? { randomInt, sendSms: async (to, body) => {
    if (to !== '+19153367080' || attempts >= sendLimit || body.length > 306 || /[^\x20-\x7e]/.test(body)) return { sent: false, error: 'mock_send_guard' }
    attempts++ // Count attempts before network I/O, including ambiguous failures.
    const result = await sendSms(to, body)
    console.log(JSON.stringify({ attempt: attempts, sent: result.sent, error: result.error }))
    return result
  } } : {})
  if (live) {
    h.seed('editor-mock', { name: 'CityBeat Editor Mock Property', phone: '+19153367080', is_published: true })
    h.records.set('apartment_listing_links/alza-dwellings', { listing_id: 'editor-mock' })
  }
  const built = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import Claim from './apps/web/src/app/[locale]/apartments/[slug]/claim/ApartmentClaimClient';
      import {getApartment} from './apps/web/src/lib/apartments';
      const parts=location.pathname.split('/');
      const community=getApartment(parts[3] || 'alza-dwellings');
      createRoot(document.getElementById('app')).render(<Claim community={${live ? "{...community,name:'CityBeat Editor Mock Property',phone:'9153367080'}" : 'community'}} locale={parts[1]==='es'?'es':'en'}/>);`, loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', tsconfig: 'apps/web/tsconfig.json',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-shell', setup(b) {
      b.onResolve({ filter: /^(next\/link|@\/components\/citybeat\/CityBeatShell)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'next/link'
        ? `import React from 'react'; export default function Link(props){return <a {...props}/>}`
        : `import React from 'react'; export function CityBeatShell({children}){return <><header>${live ? 'EDITOR MOCK TEST — Real SMS, isolated temporary property. No public listing changes.' : 'ISOLATED TEST — Simulated SMS and database'}</header><main>{children}</main></>}`,
        loader: 'jsx', resolveDir: resolve('apps/web') }))
    } }],
  })
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://127.0.0.1').pathname
      if (path === '/app.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(built.outputFiles[0].text); return }
      let response: Response | undefined
      if (path === '/api/profile') response = Response.json({ profile: h.currentUser() })
      if (live && path === '/mock-status') response = Response.json({ attempts,
        property: { owner: h.records.get('directory_listings/editor-mock')?.owner_id || null,
          status: h.records.get('directory_listings/editor-mock')?.claim_status },
      })
      const match = path.match(/^\/api\/apartments\/([^/]+)\/claim(?:\/(start|verify))?$/)
      if (match) {
        let raw = ''; for await (const part of req) raw += part
        const body = raw ? JSON.parse(raw) : {}
        if (live && (match[1] !== 'alza-dwellings' || (req.method !== 'GET' && req.headers.origin !== 'http://127.0.0.1:3012'))) {
          res.writeHead(403); res.end('Mock origin or property denied'); return
        }
        response = match[2] === 'start' ? await h.apartmentStart(body, match[1])
          : match[2] === 'verify' ? await h.apartmentVerify(body, match[1]) : await h.apartmentGet(match[1])
      }
      if (response) { res.writeHead(response.status, { 'Content-Type': 'application/json' }); res.end(await response.text()); return }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated apartment claim test</title><style>body{font:16px system-ui;background:#0a1723;color:white;margin:0}header{padding:12px;background:#775c00}main{max-width:680px;margin:30px auto;padding:20px}a{color:#00d8eb}section>*,form>*{margin-top:18px}p{line-height:1.5}button,input{padding:14px;font:inherit}button{display:block;background:#00d8eb;color:black;border:0;border-radius:6px}button:disabled{opacity:.4}input[type=checkbox]{width:22px;height:22px}label{display:block}h1{font-size:32px}</style></head><body><div id="app"></div><script src="/app.js"></script></body></html>`)
    } catch (e) { res.statusCode = 500; res.end('Isolated fixture failed'); console.error(e) }
  })
  server.listen(3012, '127.0.0.1', () => console.log(live
    ? `Editor mock at http://127.0.0.1:3012/en/apartments/alza-dwellings/claim; maximum ${sendLimit} real SMS this process. Enter received code in browser only.`
    : 'Isolated apartment claim fixture on 127.0.0.1:3012; test code 654321. No external sends.'))
}
void main()
