import { Resolver } from 'node:dns/promises'
import { request } from 'node:https'
import { publicIpv4, publicWebsiteUrl } from './website-prefill'

// Pin the validated IPv4 at the socket layer: a second DNS lookup must not
// turn a public validation result into a request to an internal service.
export async function fetchPrefillPage(input: string, redirects = 0, allowedHost?: string): Promise<{ html: string; url: string }> {
  const url = publicWebsiteUrl(input)
  const host = url.hostname.replace(/^www\./,'')
  if (allowedHost && host !== allowedHost) throw new Error('Redirect left the selected business website.')
  const resolver = new Resolver({ timeout: 2000, tries: 1 })
  const addresses = await resolver.resolve4(url.hostname)
  if (!addresses.length || addresses.some(ip => !publicIpv4(ip))) throw new Error('Website resolves to a private or reserved address.')
  const result = await new Promise<{ html?: string; location?: string }>((resolve,reject) => {
    const req = request(url, { headers: { Accept:'text/html,application/xhtml+xml', 'Accept-Encoding':'identity', 'User-Agent':'CityBeat-Owner-Prefill/1.0' },
      lookup: ((_host: string, options: any, callback: any) => options?.all ? callback(null,[{address:addresses[0],family:4}]) : callback(null,addresses[0],4)) as any,
    }, res => {
      if ([301,302,303,307,308].includes(res.statusCode || 0)) { res.resume(); resolve({location:res.headers.location}); return }
      if (res.statusCode !== 200 || !/^(text\/html|application\/xhtml\+xml)/i.test(String(res.headers['content-type'])) ||
          res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.resume(); reject(new Error('Website did not return a readable HTML page.')); return }
      let size=0; const chunks: Buffer[]=[]
      res.on('data', chunk => { size+=chunk.length; if(size>1024*1024) { req.destroy(new Error('Website page exceeds the 1 MiB preview limit.')); return } chunks.push(chunk) })
      res.on('error',reject)
      res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}))
    })
    const timer = setTimeout(()=>req.destroy(new Error('Website preview timed out.')),8000)
    req.on('close',()=>clearTimeout(timer)); req.on('error',reject); req.end()
  })
  if (result.location) {
    if (redirects>=2) throw new Error('Too many website redirects.')
    return fetchPrefillPage(new URL(result.location,url).href,redirects+1,host)
  }
  if (result.html === undefined) throw new Error('Website redirect was incomplete.')
  return {html:result.html,url:url.href}
}
