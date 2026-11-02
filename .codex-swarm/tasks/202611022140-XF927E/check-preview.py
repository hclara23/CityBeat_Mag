import json, html
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from html.parser import HTMLParser

class Page(HTMLParser):
 def __init__(self):
  super().__init__(); self.links=[]; self.images=[]; self.text=[]
 def handle_starttag(self, tag, attrs):
  a=dict(attrs)
  if tag=='a': self.links.append(a.get('href',''))
  if tag=='img': self.images.append(a.get('src',''))
 def handle_data(self, data): self.text.append(data)

base=Path('apps/web/src/lib')
rows=sum([json.loads((base/f).read_text()) for f in ['apartment-integrity.json','apartment-case.json']],[])
research=json.loads((base/'apartment-enrichment.json').read_text(encoding='utf-8'))
def check(item):
 row,locale=item; slug=row['slug']; r=research[slug]
 try:
  with urlopen(f'http://localhost:3012/{locale}/apartments/{slug}',timeout=90) as response:
   assert response.status==200
   page=Page(); page.feed(response.read().decode())
  text=' '.join(page.text)
  assert row['name'] in text, 'name'
  assert r['summary'][locale] in text, 'localized summary'
  assert row['website'] in page.links, 'website link'
  assert f'/{locale}/apartments/{slug}/claim' in page.links, 'claim link'
  assert ('Visitar sitio web' if locale=='es' else 'Visit website') in text, 'website label'
  for p in r['photos']: assert p['url'] in page.images, 'photo'
  if r.get('verificationNote'): assert r['verificationNote'][locale] in text, 'verification note'
  return {'slug':slug,'locale':locale,'ok':True}
 except Exception as e: return {'slug':slug,'locale':locale,'ok':False,'error':str(e)}
results=[]
with ThreadPoolExecutor(max_workers=6) as pool:
 for result in pool.map(check,[(row,locale) for row in rows for locale in ['en','es']]):
  results.append(result)
  if len(results)%20==0: print('Checked',len(results),flush=True)
Path(__file__).with_name('preview-checks.json').write_text(json.dumps(results,indent=2))
print('Passed',sum(x['ok'] for x in results),'of',len(results),flush=True)
assert all(x['ok'] for x in results),[x for x in results if not x['ok']]
