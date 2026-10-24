// Local-only browser fault injection; never part of the application runtime.
import http from 'node:http'
let failNext = true
http.createServer((request, response) => {
  if (request.url?.startsWith('/api/directory?') && failNext) {
    failNext = false
    response.writeHead(503, {'Content-Type':'application/json','Cache-Control':'no-store'})
    response.end(JSON.stringify({error:'Local verification outage'}))
    console.log('Injected one directory 503; subsequent requests use the local app.')
    return
  }
  const upstream=http.request({hostname:'127.0.0.1',port:3199,path:request.url,method:request.method,
    headers:{...request.headers,host:'localhost:3199'}}, result=>{
    response.writeHead(result.statusCode || 502,result.headers);result.pipe(response)
  })
  upstream.on('error',()=>{response.writeHead(502);response.end('Local app unavailable')})
  request.pipe(upstream)
}).listen(3200,'127.0.0.1',()=>console.log('Local outage test proxy on 127.0.0.1:3200'))
