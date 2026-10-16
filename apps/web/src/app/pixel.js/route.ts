import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const id = params.get('id') || ''
  const key = params.get('key') || ''
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !/^[A-Za-z0-9_-]{20,100}$/.test(key)) {
    return new NextResponse('/* Invalid CityBeat pixel configuration. */', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const config = JSON.stringify({ id, key })
  const script = `(()=>{const c=${config};const endpoint='https://citybeatmag.co/api/track/pixel';const allowed=new Set(['page_view','conversion','lead','purchase']);function send(event){if(!allowed.has(event))return;const body=JSON.stringify({listingId:c.id,key:c.key,event});try{if(navigator.sendBeacon){navigator.sendBeacon(endpoint,new Blob([body],{type:'text/plain'}));return}fetch(endpoint,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain'},body}).catch(()=>{})}catch(_){}}window.citybeatPixel=function(event){send(event||'conversion')};send('page_view');document.addEventListener('click',e=>{const el=e.target&&e.target.closest?e.target.closest('[data-citybeat-conversion]'):null;if(el)send(el.getAttribute('data-citybeat-conversion')||'conversion')},{passive:true});})();`
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  })
}
