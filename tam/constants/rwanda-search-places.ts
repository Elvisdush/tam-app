export type RwandaSearchPlace = {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  search: string;
  kind: 'sector' | 'street';
};

/**
 * Rwanda sectors + common street names used by riders/drivers.
 * Sector names include district in parentheses to disambiguate duplicates.
 */
export const RWANDA_SEARCH_PLACES: RwandaSearchPlace[] = [
  // Kigali sectors (district in parentheses)
  { id: 'sec-kimironko-gasabo', name: 'Kimironko (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.9558, longitude: 30.1222, search: 'kimironko gasabo sector kigali', kind: 'sector' },
  { id: 'sec-kacyiru-gasabo', name: 'Kacyiru (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.9353, longitude: 30.0826, search: 'kacyiru gasabo sector kigali', kind: 'sector' },
  { id: 'sec-remera-gasabo', name: 'Remera (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.9555, longitude: 30.1121, search: 'remera gasabo sector kigali', kind: 'sector' },
  { id: 'sec-nyarutarama-gasabo', name: 'Nyarutarama (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.9365, longitude: 30.0931, search: 'nyarutarama gasabo sector kigali', kind: 'sector' },
  { id: 'sec-kimironko-market', name: 'Kimironko Market Area (Gasabo)', subtitle: 'Sector area · Gasabo District, Kigali', latitude: -1.9496, longitude: 30.1253, search: 'kimironko market gasabo', kind: 'sector' },
  { id: 'sec-gisozi-gasabo', name: 'Gisozi (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.9278, longitude: 30.0901, search: 'gisozi gasabo sector kigali', kind: 'sector' },
  { id: 'sec-jali-gasabo', name: 'Jali (Gasabo)', subtitle: 'Sector · Gasabo District, Kigali', latitude: -1.874, longitude: 30.1176, search: 'jali gasabo sector', kind: 'sector' },
  { id: 'sec-kanombe-kicukiro', name: 'Kanombe (Kicukiro)', subtitle: 'Sector · Kicukiro District, Kigali', latitude: -1.9691, longitude: 30.1458, search: 'kanombe kicukiro sector kigali airport', kind: 'sector' },
  { id: 'sec-gikondo-kicukiro', name: 'Gikondo (Kicukiro)', subtitle: 'Sector · Kicukiro District, Kigali', latitude: -1.9877, longitude: 30.0859, search: 'gikondo kicukiro sector', kind: 'sector' },
  { id: 'sec-kagarama-kicukiro', name: 'Kagarama (Kicukiro)', subtitle: 'Sector · Kicukiro District, Kigali', latitude: -1.9898, longitude: 30.1113, search: 'kagarama kicukiro sector', kind: 'sector' },
  { id: 'sec-kicukiro-kicukiro', name: 'Kicukiro (Kicukiro)', subtitle: 'Sector · Kicukiro District, Kigali', latitude: -1.9722, longitude: 30.1032, search: 'kicukiro sector kicukiro district', kind: 'sector' },
  { id: 'sec-kigali-nyarugenge', name: 'Kigali (Nyarugenge)', subtitle: 'Sector · Nyarugenge District, Kigali', latitude: -1.9493, longitude: 30.0616, search: 'kigali sector nyarugenge', kind: 'sector' },
  { id: 'sec-muhima-nyarugenge', name: 'Muhima (Nyarugenge)', subtitle: 'Sector · Nyarugenge District, Kigali', latitude: -1.9442, longitude: 30.0534, search: 'muhima nyarugenge sector', kind: 'sector' },
  { id: 'sec-nyamirambo-nyarugenge', name: 'Nyamirambo (Nyarugenge)', subtitle: 'Sector · Nyarugenge District, Kigali', latitude: -1.9698, longitude: 29.9988, search: 'nyamirambo nyarugenge sector', kind: 'sector' },
  { id: 'sec-rwezamenyo-nyarugenge', name: 'Rwezamenyo (Nyarugenge)', subtitle: 'Sector · Nyarugenge District, Kigali', latitude: -1.9581, longitude: 30.0507, search: 'rwezamenyo nyarugenge sector', kind: 'sector' },

  // Other province sectors (with district disambiguation)
  { id: 'sec-gatenga-kicukiro', name: 'Gatenga (Kicukiro)', subtitle: 'Sector · Kicukiro District', latitude: -1.996, longitude: 30.094, search: 'gatenga kicukiro sector', kind: 'sector' },
  { id: 'sec-bugarama-rusizi', name: 'Bugarama (Rusizi)', subtitle: 'Sector · Rusizi District, Western Province', latitude: -2.6892, longitude: 29.0268, search: 'bugarama rusizi sector', kind: 'sector' },
  { id: 'sec-gihundwe-rusizi', name: 'Gihundwe (Rusizi)', subtitle: 'Sector · Rusizi District, Western Province', latitude: -2.4755, longitude: 28.9032, search: 'gihundwe rusizi sector cyangugu', kind: 'sector' },
  { id: 'sec-mukingo-musanze', name: 'Mukingo (Musanze)', subtitle: 'Sector · Musanze District, Northern Province', latitude: -1.5056, longitude: 29.6339, search: 'mukingo musanze sector ruhengeri', kind: 'sector' },
  { id: 'sec-kinigi-musanze', name: 'Kinigi (Musanze)', subtitle: 'Sector · Musanze District, Northern Province', latitude: -1.4632, longitude: 29.5926, search: 'kinigi musanze sector volcanoes', kind: 'sector' },
  { id: 'sec-byumba-gicumbi', name: 'Byumba (Gicumbi)', subtitle: 'Sector · Gicumbi District, Northern Province', latitude: -1.5775, longitude: 30.0674, search: 'byumba gicumbi sector', kind: 'sector' },
  { id: 'sec-muhanga-muhanga', name: 'Muhanga (Muhanga)', subtitle: 'Sector · Muhanga District, Southern Province', latitude: -2.0849, longitude: 29.7569, search: 'muhanga sector gitarama', kind: 'sector' },
  { id: 'sec-ngoma-huye', name: 'Ngoma (Huye)', subtitle: 'Sector · Huye District, Southern Province', latitude: -2.5965, longitude: 29.7398, search: 'ngoma huye sector butare', kind: 'sector' },
  { id: 'sec-kamembe-rusizi', name: 'Kamembe (Rusizi)', subtitle: 'Sector · Rusizi District, Western Province', latitude: -2.4824, longitude: 28.8971, search: 'kamembe rusizi sector airport', kind: 'sector' },
  { id: 'sec-rubavu-rubavu', name: 'Rubavu (Rubavu)', subtitle: 'Sector · Rubavu District, Western Province', latitude: -1.6767, longitude: 29.2635, search: 'rubavu sector gisenyi', kind: 'sector' },
  { id: 'sec-kibungo-ngoma', name: 'Kibungo (Ngoma)', subtitle: 'Sector · Ngoma District, Eastern Province', latitude: -2.1591, longitude: 30.5424, search: 'kibungo ngoma sector', kind: 'sector' },
  { id: 'sec-nyamata-bugesera', name: 'Nyamata (Bugesera)', subtitle: 'Sector · Bugesera District, Eastern Province', latitude: -2.1459, longitude: 30.1069, search: 'nyamata bugesera sector', kind: 'sector' },
  { id: 'sec-rwamagana-rwamagana', name: 'Rwamagana (Rwamagana)', subtitle: 'Sector · Rwamagana District, Eastern Province', latitude: -1.9486, longitude: 30.4347, search: 'rwamagana sector', kind: 'sector' },
  { id: 'sec-kayonza-kayonza', name: 'Kayonza (Kayonza)', subtitle: 'Sector · Kayonza District, Eastern Province', latitude: -1.8686, longitude: 30.5338, search: 'kayonza sector', kind: 'sector' },
  { id: 'sec-nyagatare-nyagatare', name: 'Nyagatare (Nyagatare)', subtitle: 'Sector · Nyagatare District, Eastern Province', latitude: -1.3021, longitude: 30.3254, search: 'nyagatare sector', kind: 'sector' },

  // Kigali streets
  { id: 'st-kk-1', name: 'KK 1 Ave', subtitle: 'Street · Kigali', latitude: -1.9643, longitude: 30.1033, search: 'kk 1 ave kk1 avenue kigali', kind: 'street' },
  { id: 'st-kk-3', name: 'KK 3 Rd', subtitle: 'Street · Kigali', latitude: -1.9578, longitude: 30.1087, search: 'kk 3 rd kk3 road kigali', kind: 'street' },
  { id: 'st-kk-5', name: 'KK 5 Ave', subtitle: 'Street · Kigali', latitude: -1.9487, longitude: 30.1134, search: 'kk 5 ave kk5 avenue', kind: 'street' },
  { id: 'st-kk-11', name: 'KK 11 Ave', subtitle: 'Street · Kigali', latitude: -1.9554, longitude: 30.1244, search: 'kk 11 ave kk11 avenue', kind: 'street' },
  { id: 'st-kk-15', name: 'KK 15 Rd', subtitle: 'Street · Kigali', latitude: -1.9425, longitude: 30.0896, search: 'kk 15 rd kk15 road', kind: 'street' },
  { id: 'st-kk-31', name: 'KK 31 Ave', subtitle: 'Street · Kigali', latitude: -1.9759, longitude: 30.1072, search: 'kk 31 ave kk31 avenue', kind: 'street' },
  { id: 'st-kk-450', name: 'KK 450 St', subtitle: 'Street · Kigali', latitude: -1.9785, longitude: 30.1154, search: 'kk 450 st kk450 street', kind: 'street' },
  { id: 'st-kk-454', name: 'KK 454 St', subtitle: 'Street · Kigali', latitude: -1.9738, longitude: 30.1188, search: 'kk 454 st kk454 street', kind: 'street' },
  { id: 'st-kk-507', name: 'KK 507 St', subtitle: 'Street · Kigali', latitude: -1.9899, longitude: 30.1016, search: 'kk 507 st kk507 street', kind: 'street' },
  { id: 'st-kk-517', name: 'KK 517 St', subtitle: 'Street · Kigali', latitude: -1.9957, longitude: 30.1049, search: 'kk 517 st kk517 street', kind: 'street' },
  { id: 'st-kg-11', name: 'KG 11 Ave', subtitle: 'Street · Kigali', latitude: -1.9513, longitude: 30.0648, search: 'kg 11 ave kg11 avenue', kind: 'street' },
  { id: 'st-kg-14', name: 'KG 14 Ave', subtitle: 'Street · Kigali', latitude: -1.9448, longitude: 30.0747, search: 'kg 14 ave kg14 avenue', kind: 'street' },
  { id: 'st-kg-17', name: 'KG 17 Ave', subtitle: 'Street · Kigali', latitude: -1.9413, longitude: 30.0828, search: 'kg 17 ave kg17 avenue', kind: 'street' },
  { id: 'st-kn-2', name: 'KN 2 Ave', subtitle: 'Street · Kigali', latitude: -1.9475, longitude: 30.0601, search: 'kn 2 ave kn2 avenue city center', kind: 'street' },
  { id: 'st-kn-3', name: 'KN 3 Ave', subtitle: 'Street · Kigali', latitude: -1.9468, longitude: 30.0595, search: 'kn 3 ave kn3 avenue', kind: 'street' },
  { id: 'st-kn-4', name: 'KN 4 Ave', subtitle: 'Street · Kigali', latitude: -1.9492, longitude: 30.0574, search: 'kn 4 ave kn4 avenue', kind: 'street' },
  { id: 'st-kn-5', name: 'KN 5 Rd', subtitle: 'Street · Kigali', latitude: -1.9531, longitude: 30.0512, search: 'kn 5 rd kn5 road', kind: 'street' },
  { id: 'st-kn-67', name: 'KN 67 St', subtitle: 'Street · Kigali', latitude: -1.9624, longitude: 30.0663, search: 'kn 67 st kn67 street', kind: 'street' },

  // Other towns / inter-city named roads
  { id: 'st-rn1-kigali-muhanga', name: 'RN1 Kigali–Muhanga Rd', subtitle: 'National Road · Kigali / Southern Province', latitude: -1.99, longitude: 30.02, search: 'rn1 kigali muhanga road', kind: 'street' },
  { id: 'st-rn3-kigali-rubavu', name: 'RN3 Kigali–Rubavu Rd', subtitle: 'National Road · Kigali / Western Province', latitude: -1.91, longitude: 29.92, search: 'rn3 kigali rubavu gisenyi road', kind: 'street' },
  { id: 'st-rn15-kigali-nyagatare', name: 'RN15 Kigali–Nyagatare Rd', subtitle: 'National Road · Kigali / Eastern Province', latitude: -1.74, longitude: 30.25, search: 'rn15 kigali nyagatare road', kind: 'street' },
  { id: 'st-airport-road', name: 'Airport Road (Kanombe)', subtitle: 'Main Road · Kigali', latitude: -1.9682, longitude: 30.1395, search: 'airport road kanombe kigali', kind: 'street' },
  { id: 'st-kigali-huye-road', name: 'Kigali–Huye Road', subtitle: 'Main Road · Southern Province', latitude: -2.34, longitude: 29.79, search: 'kigali huye butare road', kind: 'street' },
  { id: 'st-rusizi-main-st', name: 'Avenue de la Corniche (Rusizi)', subtitle: 'Street · Rusizi', latitude: -2.4869, longitude: 28.9003, search: 'corniche avenue rusizi street cyangugu', kind: 'street' },
  { id: 'st-rubavu-lake-road', name: 'Lake Kivu Avenue (Rubavu)', subtitle: 'Street · Rubavu', latitude: -1.7062, longitude: 29.2577, search: 'lake kivu avenue rubavu gisenyi street', kind: 'street' },
  { id: 'st-musanze-main', name: 'Musanze Main Street', subtitle: 'Street · Musanze', latitude: -1.4999, longitude: 29.6349, search: 'musanze main street ruhengeri', kind: 'street' },
  { id: 'st-huye-university-road', name: 'University Road (Huye)', subtitle: 'Street · Huye', latitude: -2.6031, longitude: 29.739, search: 'university road huye butare', kind: 'street' },
  { id: 'st-rwamagana-main', name: 'Rwamagana Main Street', subtitle: 'Street · Rwamagana', latitude: -1.9484, longitude: 30.4344, search: 'rwamagana main street', kind: 'street' },
  { id: 'st-kayonza-main', name: 'Kayonza Main Street', subtitle: 'Street · Kayonza', latitude: -1.8689, longitude: 30.5328, search: 'kayonza main street', kind: 'street' },
];
