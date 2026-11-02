import json
from pathlib import Path
base=Path('apps/web/src/lib')
def local(en,es): return {'en':en,'es':es}
items=[
 dict(slug='8636-lawson-apartments',name='8636 Lawson Apartments',address='8636 Lawson St',city='El Paso',state='TX',zip='79904',phone='9159955616',uid='22361c30-1593-43e8-88c2-17ee5cbbe7f4',
 summary=local('An apartment building in Northeast El Paso with a residence advertised by Haggerty. The published Unit 3 has one bedroom, refrigerated air conditioning and tiled floors.','Un edificio de apartamentos en el noreste de El Paso con una vivienda anunciada por Haggerty. La unidad 3 publicada tiene una recámara, aire acondicionado refrigerado y pisos de loseta.'),
 highlights=local(['Advertised unit: refrigerated A/C','Advertised unit: tile flooring','Advertised unit: refrigerator and stove','Advertised terms: water and trash included'],['Unidad anunciada: aire acondicionado refrigerado','Unidad anunciada: pisos de loseta','Unidad anunciada: refrigerador y estufa','Condiciones anunciadas: agua y basura incluidas']),
 layouts=local('Published Unit 3: 1 bedroom, 1 bathroom, approximately 600 sq ft. Other units may differ.','Unidad 3 publicada: 1 recámara, 1 baño y aproximadamente 600 pies cuadrados. Otras unidades pueden variar.'),
 images=['28acb7c1-8632-4354-bf16-867f512c396c','9b6de0f8-b636-4c6a-9eee-8bf7f1b4b4db','5574982e-970f-4610-8eb3-3d085b1c39ab'],extension='jpeg',
 corroboration='https://www.padmapper.com/buildings/p360297/lawson-st-8636-apartments-at-8636-lawson-st-el-paso-tx-79904'),
 dict(slug='1402-s-espina-apartments',name='1402 S. Espina Apartments',address='1402 S Espina St',city='Las Cruces',state='NM',zip='88001',uid='7c6f6dcd-92c1-4bba-9152-7ee85adb2a65',
 summary=local('Apartments near NMSU in Las Cruces. Haggerty’s published Apartment 3 has two bedrooms, a stove and refrigerator. Its advertised rental terms include water, sewer and trash.','Apartamentos cerca de NMSU en Las Cruces. El apartamento 3 publicado por Haggerty tiene dos recámaras, estufa y refrigerador. Sus condiciones anunciadas incluyen agua, alcantarillado y recolección de basura.'),
 highlights=local(['Near NMSU','Advertised unit: stove and refrigerator','Advertised terms: water, sewer and trash included'],['Cerca de NMSU','Unidad anunciada: estufa y refrigerador','Condiciones anunciadas: agua, alcantarillado y basura incluidos']),
 layouts=local('Published Apartment 3: 2 bedrooms, 1 bathroom, approximately 750 sq ft. Other units may differ.','Apartamento 3 publicado: 2 recámaras, 1 baño y aproximadamente 750 pies cuadrados. Otras unidades pueden variar.'),
 images=['1b83fc6b-2b29-4836-a7d3-e46c38045e1c','c318e246-ef10-4f2c-8dd1-1f07f1b8fb8b','03437892-280d-4f41-be92-dad0465c4cee'],extension='jpg',
 corroboration='https://www.zumper.com/apartment-buildings/p432277/1402-s-espina-las-cruces-nm'),
 dict(slug='1705-payne-street-triplex',name='1705 Payne Street Triplex',address='1705 Payne St',city='Las Cruces',state='NM',zip='88001',uid='3ada769e-0ced-4239-bf38-51aa9000c7ca',
 summary=local('A small triplex in Las Cruces near NMSU. The advertised townhome-style residence has two upstairs bedrooms, a laundry area, front and back yards, a covered carport and additional storage.','Un pequeño triplex en Las Cruces cerca de NMSU. La vivienda anunciada de estilo casa adosada tiene dos recámaras en la planta alta, área de lavandería, patios delantero y trasero, estacionamiento techado y almacenamiento adicional.'),
 highlights=local(['Advertised residence: covered carport','Advertised residence: laundry area','Advertised residence: front and back yards','Advertised residence: additional storage'],['Vivienda anunciada: estacionamiento techado','Vivienda anunciada: área de lavandería','Vivienda anunciada: patios delantero y trasero','Vivienda anunciada: almacenamiento adicional']),
 layouts=local('Published residence: 2 bedrooms, 1.5 bathrooms, approximately 1,140 sq ft. The official description identifies a triplex; features may differ between homes.','Vivienda publicada: 2 recámaras, 1.5 baños y aproximadamente 1,140 pies cuadrados. La descripción oficial identifica un triplex; las características pueden variar entre viviendas.'),
 images=['63ee047a-664b-487b-9e8d-dd48d487e460','69cdaee7-1992-4519-ae4d-8955c746ccd3','a12dc3a1-1657-4441-bb7d-611ccdad9915'],extension='jpg')
]
catalog=[]; research={}
for item in items:
 url='https://century21haggerty.appfolio.com/listings/detail/'+item['uid']
 catalog.append({**{k:item[k] for k in ['slug','name','address','city','state','zip']},'phone':item.get('phone','9157573445'),'website':url,'source':url,'companyId':'haggerty-company','type':'apartments'})
 similar=item['slug']=='1402-s-espina-apartments'
 caption=local('Similar-unit photo from the management company’s listing; the available residence may differ.','Foto de una unidad similar publicada por la administradora; la vivienda disponible puede variar.') if similar else local('Photo of the advertised residence from the management company’s listing.','Foto de la vivienda anunciada en la ficha de la administradora.')
 note=local('Details describe the advertised residence, not every unit in the building. Confirm current amenities, utility terms and management scope with Haggerty.','Los detalles describen la vivienda anunciada, no todas las unidades del edificio. Confirma las amenidades actuales, condiciones de servicios y alcance de la administración con Haggerty.')
 if similar:
  note=local('The official listing says its photos show a similar unit. Details and utilities describe Apartment 3 only; confirm current conditions and management scope with Haggerty.','El anuncio oficial indica que sus fotos muestran una unidad similar. Los detalles y servicios corresponden solo al apartamento 3; confirma las condiciones actuales y el alcance de la administración con Haggerty.')
 research[item['slug']]={'checkedAt':'2026-11-02',**{k:item[k] for k in ['summary','highlights','layouts']},'verificationNote':note,'galleryUrl':url,'photos':[{'url':'https://images.cdn.appfolio.com/century21haggerty/images/'+id+'/large.'+item['extension'],'sourceUrl':url,'caption':caption} for id in item['images']], 'sources':[url,'https://www.haggertyrentals.com/vacancies' if item['state']=='TX' else 'https://www.lascrucespropertyrentals.com/']}
(base/'apartment-haggerty.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
all_research=json.loads((base/'apartment-enrichment.json').read_text(encoding='utf-8')); all_research.update(research)
(base/'apartment-enrichment.json').write_text(json.dumps(all_research,ensure_ascii=False,indent=2),encoding='utf-8')
Path(__file__).with_name('haggerty-research.json').write_text(json.dumps({'checkedAt':'2026-11-02','properties':[{'slug':k,**v} for k,v in research.items()],'buildingCorroboration':{i['slug']:i.get('corroboration',catalog[2]['source']) for i in items},'excluded':['Individual condos:2723SacramentoC,2930ClaudeDoveUnit2','Unresolved duplex/building scope:905BransonB','No current official listing:1406Espina,1460Alamo,908Foster','Individual houses and duplexes']},ensure_ascii=False,indent=2),encoding='utf-8')
