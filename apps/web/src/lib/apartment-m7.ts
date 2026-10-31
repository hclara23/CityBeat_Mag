import type { ApartmentCommunity } from './apartments'

// Observed on M7's public Community Locator on 2026-10-30.
// One record per published El Paso location, including the two combined entries.
const source = 'https://www.m7elp.com/search.html'
const rows = [
  ['wedgewood-eastridge', 'Wedgewood / Eastridge', '2118 Wedgewood Dr', '79925', '9155988291', source],
  ['villa-ciento', 'Villa Ciento', '8604 Dyer St', '79904', '8333139535', 'https://villaciento.com/'],
  ['the-nest-at-garza-azul', 'The Nest at Garza Azul', '9740 Galilee Dr', '79927', '9155924549', 'https://nestatgarzaazul.com/'],
  ['parkland-pointe', 'Parkland Pointe', '9960 McCombs St', '79924', '9157558016', 'https://parklandpointeapartments.com/'],
  ['mountain-vista', 'Mountain Vista', '5757 Will Ruth Ave', '79924', '9157515757', 'https://mountainvistaep.com/'],
  ['monterrey-gardens', 'Monterrey Gardens', '1435 Miracle Way', '79925', '9155927561', 'https://monterreygardensep.com/'],
  ['monterrey-east-vista-sierra', 'Monterrey East / Vista Sierra', '6808 Bellrose Dr', '79925', '9157781427', 'https://monterreyeast.com/'],
  ['lee-place', 'Lee Place', '11520 Montana Ave', '79936', '9152522568', 'https://leeplaceep.com/'],
  ['las-mansiones-at-eastlake', 'Las Mansiones at Eastlake', '12701 Eastlake Blvd', '79928', '8669245593', 'https://lasmansioneseastlake.com/'],
  ['las-mansiones-at-cimarron', 'Las Mansiones at Cimarron', '1776 Cimarron Sq', '79911', '9157041776', 'https://lasmansionescimarron.com/'],
  ['las-mansiones', 'Las Mansiones', '1500 Bob Hope Dr', '79936', '9155913303', 'https://lasmansionesonline.com/'],
  ['dieter-pines', 'Dieter Pines', '3650 George Dieter Dr', '79936', '9158578999', 'https://dieterpinesep.com/'],
  ['desert-sky', 'Desert Sky', '9924 Railroad Dr', '79924', '9157519924', 'https://desertskyapts.com/'],
  ['cliffside-at-mountain-park', 'Cliffside at Mountain Park', '3333 Zion Ln', '79904', '8335691751', 'https://cliffsideatmountainpark.com/'],
  ['chapel-hill-place', 'Chapel Hill Place', '12501 Rojas Dr', '79928', '9154796504', 'https://chapelhillep.com/'],
  ['bartlett', 'Bartlett', '330 Bartlett Dr', '79912', '9155846911', 'https://bartlettep.com/'],
  ['amigos-del-sol', 'Amigos del Sol', '10009 Rushing Rd', '79924', '9152564908', source],
  ['album-park', 'Album Park', '2655 N Yarbrough Dr', '79925', '9155914125', 'https://albumpark.com/'],
  ['north-view-apartments', 'North View Apartments', '6411 S Angora Loop Ave', '79934', '8449203496', 'https://northviewep.com/'],
] as const

export const M7_APARTMENTS: readonly ApartmentCommunity[] = rows.map(([slug, name, address, zip, phone, website]) => ({
  slug, name, address, zip, phone, website, type: 'apartments', companyId: 'm7-elp', source,
  summary: { en: `${name} is listed in M7 ELP's official community locator. Contact the leasing team for current layouts, amenities and availability.`, es: `${name} aparece en el localizador oficial de comunidades de M7 ELP. Consulta los planos, amenidades y disponibilidad con el equipo de arrendamiento.` },
  highlights: { en: [], es: [] },
}))
