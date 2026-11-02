import json, io, sys
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps, ImageDraw
root=Path(__file__).resolve().parent
name=sys.argv[1]
r=json.loads((root/(name+'-research.json')).read_text(encoding='utf-8-sig'))
items=[(p['slug'],photo) for p in r['properties'] for photo in p.get('photos',[])]
folder=Path('node_modules/.citybeat-integrity-case-images'); folder.mkdir(exist_ok=True)
def fetch(item):
 slug,p=item
 try:
  with urlopen(Request(p['url'],headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as response: data=response.read(12000000)
  im=Image.open(io.BytesIO(data)); im.load()
  return slug,p,im,None
 except Exception as e: return slug,p,None,str(e)
results=list(ThreadPoolExecutor(max_workers=8).map(fetch,items))
(root/(name+'-image-checks.json')).write_text(json.dumps([{'slug':s,'url':p['url'],'size':im.size if im else None,'error':e} for s,p,im,e in results],indent=2),encoding='utf-8')
for part in range((len(results)+23)//24):
 group=results[part*24:(part+1)*24]; sheet=Image.new('RGB',(1000,210*((len(group)+3)//4)),'white'); d=ImageDraw.Draw(sheet)
 for i,(slug,p,im,e) in enumerate(group):
  x=(i%4)*250; y=(i//4)*210
  if im: sheet.paste(ImageOps.contain(im.convert('RGB'),(245,175)),(x,y))
  d.text((x,y+177),f'{part*24+i}: {slug[:29]}',fill='black')
  if e: d.text((x,y+20),e[:32],fill='red')
 sheet.save(folder/f'{name}-{part}.jpg')
print(name, 'images',len(results),'successful',sum(im is not None for _,_,im,_ in results))
