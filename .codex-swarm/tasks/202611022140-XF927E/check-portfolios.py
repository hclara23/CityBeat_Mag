from urllib.request import urlopen
from html.parser import HTMLParser
import json
from pathlib import Path
class Page(HTMLParser):
 def __init__(self): super().__init__(); self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a': self.links.append(dict(attrs).get('href',''))
checks=[]
for company,count in [('integrity-asset-management',60),('case-associates',9)]:
 for locale in ['en','es']:
  with urlopen(f'http://localhost:3012/{locale}/property-management/{company}',timeout=90) as response:
   page=Page(); page.feed(response.read().decode())
  links={u for u in page.links if u.startswith(f'/{locale}/apartments/') and not u.endswith('/claim')}
  assert len(links)==count,(company,locale,len(links))
  checks.append({'company':company,'locale':locale,'count':count,'ok':True})
  print(checks[-1],flush=True)
Path(__file__).with_name('portfolio-checks.json').write_text(json.dumps(checks,indent=2))
