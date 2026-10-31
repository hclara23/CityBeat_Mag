import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import QRCode from 'qrcode'
const root=fileURLToPath(new URL('../../',import.meta.url))
const area=JSON.parse(await readFile(resolve(root,'packages/lib/src/directory/service-area.json'),'utf8'))
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function validatePromotion(input){
  const city=area.cities.find(c=>c.aliases.includes(String(input.city || '').toLowerCase().trim()))
  if(!city)throw new Error('Choose one of the eleven approved localities.')
  const name=String(input.name || '').trim()
  if(name.length<2 || name.length>70)throw new Error('Business name must be 2–70 characters.')
  const url=new URL(input.url)
  if(url.protocol!=='https:' || url.hostname!=='citybeatmag.co' || url.username || url.password || !/^\/(?:b\/|(?:en|es)\/directory(?:\/|$))/.test(url.pathname))throw new Error('Use the public CityBeat directory or listing URL.')
  url.search='';url.hash=''
  url.searchParams.set('utm_source','citybeat');url.searchParams.set('utm_medium','qr');url.searchParams.set('utm_campaign','social-card')
  const services=Array.isArray(input.services)?input.services.slice(0,4).map(s=>String(s).trim()).filter(s=>s.length>0&&s.length<=55):[]
  const phone=String(input.phone || '').trim()
  if(phone && !/^[+()\d .-]{7,40}$/.test(phone))throw new Error('Invalid display phone.')
  return {name,city:city.name,category:String(input.category || 'Local business').slice(0,55),services,phone,url:url.href,portrait:input.format!=='landscape',draft:input.draft!==false}
}
export async function promotionHtml(input){
  const p=validatePromotion(input),w=p.portrait?1080:1920,h=p.portrait?1920:1080
  const qr=await QRCode.toDataURL(p.url,{width:440,margin:3,errorCorrectionLevel:'M'})
  const items=p.services.length?p.services:['Business details','Contact information','Local connections']
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=${w}, height=${h}"><title>${escape(p.name)} — CityBeat promotion draft</title><script src="gsap.min.js"></script><style>
  *{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden;background:#07121d;color:#fff;font-family:Arial,Helvetica,sans-serif}#film{position:relative;width:100%;height:100%;background:radial-gradient(ellipse at 90% 20%,#123d50 0,transparent 60%),#07121d}.brand{position:absolute;left:84px;top:85px;font-size:42px;font-weight:900;letter-spacing:-2px}.brand b{color:#05bfd8}.brand small{font-size:18px;letter-spacing:5px;margin-left:12px}.location{position:absolute;right:84px;top:100px;font-size:24px;letter-spacing:3px;color:#9aeaf2}.mountains{position:absolute;bottom:0;left:0;width:100%;height:45%;opacity:.5}.rule{position:absolute;left:84px;top:174px;width:90px;height:7px;background:#05bfd8}.scene{position:absolute;inset:${p.portrait?'300px 84px 220px':'230px 120px 150px'};display:flex;flex-direction:column;justify-content:center;gap:34px;opacity:0}.eyebrow{color:#91edf5;font-size:${p.portrait?29:30}px;letter-spacing:5px;text-transform:uppercase}.name{font-size:${p.portrait?(p.name.length>35?88:110):(p.name.length>35?104:132)}px;line-height:1.04;font-weight:900;letter-spacing:-4px;overflow-wrap:break-word;max-width:1400px}.category{font-size:38px;color:#c2dce2;line-height:1.3}.headline{font-size:${p.portrait?76:90}px;line-height:1.04;font-weight:900;letter-spacing:-3px}.services{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:20px}.service{padding:34px 28px;min-height:${p.portrait?180:130}px;border:1px solid #2b6070;border-radius:22px;background:#0a2230;font-size:${p.portrait?38:40}px;line-height:1.15}.service b{display:block;color:#05bfd8;font-size:23px;margin-bottom:20px}.final{display:grid;grid-template-columns:${p.portrait?'1fr':'1fr 500px'};align-content:center;align-items:center;gap:42px}.qr{width:440px;height:440px;border-radius:24px;${p.portrait?'justify-self:center;':''}}.cta{font-size:${p.portrait?77:90}px;line-height:1.05;font-weight:900;letter-spacing:-3px}.phone{font-size:40px;margin-top:28px;color:#b7e8ef}.url{font-size:30px;color:#96e9f1;margin-top:24px}.footer{position:absolute;left:84px;bottom:90px;font-size:23px;letter-spacing:2px;color:#9bb8c2}.draft{position:absolute;right:84px;bottom:90px;color:#9bb8c2;font-size:18px}.progress{position:absolute;bottom:0;left:0;height:10px;width:0;background:#05bfd8}
  </style></head><body><div id="film" data-composition-id="citybeat-local" data-width="${w}" data-height="${h}" data-duration="12" data-fps="30"><div class="brand">city<b>BEat</b><small>MAG</small></div><div class="location">${escape(p.city.toUpperCase())}</div><div class="rule"></div><svg class="mountains" viewBox="0 0 1920 800" preserveAspectRatio="none" aria-hidden="true"><path fill="#0b3345" d="M0 500L250 350 390 460 680 120 830 300 1050 60 1300 390 1500 210 1920 520V800H0Z"/><path fill="#10536a" opacity=".4" d="M0 650L400 450 750 650 1100 360 1450 600 1700 400 1920 650V800H0Z"/></svg>
  <section id="intro" class="scene"><p class="eyebrow">Around the corner</p><h1 class="name">${escape(p.name)}</h1><p class="category">${escape(p.category)} · ${escape(p.city)}</p></section>
  <section id="services" class="scene"><h2 class="headline">Know your<br>local options.</h2><div class="services">${items.map((s,i)=>`<div class="service"><b>0${i+1}</b>${escape(s)}</div>`).join('')}</div></section>
  <section id="contact" class="scene final"><div><h2 class="cta">Find the details.<br><span style="color:#05bfd8">Make a connection.</span></h2>${p.phone?`<p class="phone">${escape(p.phone)}</p>`:''}<p class="url">citybeatmag.co</p></div><img class="qr" src="${qr}" alt="QR code to the CityBeat directory listing" width="440" height="440"></section>
  <div class="footer">LOCAL BUSINESSES. LOCAL CONNECTIONS.</div>${p.draft?'<div class="draft">DRAFT · NOT PUBLISHED</div>':''}<div class="progress"></div></div>
  <script>var tl=gsap.timeline({paused:true});tl.to('#intro',{opacity:1,y:0,duration:.55,ease:'power2.out'},0).from('#intro .name',{y:35,duration:.7,ease:'power3.out'},0).to('#intro',{opacity:0,y:-20,duration:.35},3.6).to('#services',{opacity:1,duration:.45},4).from('#services .service',{y:30,opacity:0,stagger:.12,duration:.5},4.15).to('#services',{opacity:0,duration:.35},7.6).to('#contact',{opacity:1,duration:.5},8).to('.progress',{width:'100%',duration:12,ease:'none'},0);window.__timelines=window.__timelines||{};window.__timelines['citybeat-local']=tl;</script></body></html>`
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const inputPath=resolve(root,process.argv[2] || 'scripts/hyperframes-pilot/example.json')
  const output=resolve(root,process.argv[3] || '.tmp/citybeat-hyperframes-demo')
  if(!inputPath.startsWith(resolve(root)+sep) || !output.startsWith(resolve(root,'.tmp')+sep))throw new Error('Read repository inputs and write only inside .tmp.')
  const input=JSON.parse(await readFile(inputPath,'utf8'))
  await mkdir(output,{recursive:true})
  await writeFile(resolve(output,'index.html'),await promotionHtml(input))
  await copyFile(resolve(root,'.tmp/hyperframes-runtime/node_modules/gsap/dist/gsap.min.js'),resolve(output,'gsap.min.js'))
  console.log(`Local composition prepared: ${output}`)
}
