from pathlib import Path
import json
from urllib.parse import urlparse
root=Path(__file__).resolve().parent
base=Path('apps/web/src/lib')
records=json.loads((base/'apartment-enrichment.json').read_text(encoding='utf-8'))
new={}
for tag in ['integrity-a','integrity-b','case']:
 report=json.loads((root/(tag+'-research.json')).read_text(encoding='utf-8-sig'))
 for row in report['properties']:
  slug=row['slug']; assert slug not in new,slug
  new[slug]={k:v for k,v in row.items() if k not in ['slug','notes'] and v is not None}
  new[slug]['checkedAt']=report['checkedAt']
expected={p['slug'] for file in ['apartment-integrity.json','apartment-case.json'] for p in json.loads((base/file).read_text())}
assert set(new)==expected,(expected-set(new),set(new)-expected)
records.update(new)
(base/'apartment-enrichment.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
rows=json.loads((base/'apartment-integrity.json').read_text())
for row in rows:
 old=urlparse(row['website'])
 if old.scheme=='http':
  verified=next((u for u in new[row['slug']]['sources'] if urlparse(u).scheme=='https' and urlparse(u).hostname==old.hostname and urlparse(u).path in ['', '/']),None)
  if verified: row['website']=verified
(base/'apartment-integrity.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('New records',len(new),'new photos',sum(len(p['photos']) for p in new.values()),'total enriched',len(records))
