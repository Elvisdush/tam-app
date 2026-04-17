/**
 * Rwanda districts, major towns, and common aliases for destination search.
 * Coordinates are approximate district / town centers for routing (not building-level).
 */

export type RwandaDestination = {
  id: string;
  name: string;
  /** Shown on second line — usually province + district context */
  subtitle: string;
  latitude: number;
  longitude: number;
  /** Extra lowercase tokens for matching (aliases, old names) */
  search: string;
};

/** All 30 districts (administrative centers) plus widely used city names */
export const RWANDA_DESTINATIONS: RwandaDestination[] = [
  // Kigali City
  {
    id: 'kigali-city',
    name: 'Kigali City (center)',
    subtitle: 'Kigali City · Capital',
    latitude: -1.9441,
    longitude: 30.0619,
    search: 'kigali capital umujyi wa kigali',
  },
  {
    id: 'gasabo',
    name: 'Gasabo',
    subtitle: 'District · Kigali City',
    latitude: -1.9441,
    longitude: 30.0619,
    search: 'gasabo kigali north',
  },
  {
    id: 'kicukiro',
    name: 'Kicukiro',
    subtitle: 'District · Kigali City',
    latitude: -1.9706,
    longitude: 30.1044,
    search: 'kicukiro kigali airport kanombe',
  },
  {
    id: 'nyarugenge',
    name: 'Nyarugenge',
    subtitle: 'District · Kigali City',
    latitude: -1.9536,
    longitude: 30.0606,
    search: 'nyarugenge city centre downtown',
  },

  // Eastern Province
  {
    id: 'bugesera',
    name: 'Bugesera',
    subtitle: 'District · Eastern Province',
    latitude: -2.1528,
    longitude: 30.1758,
    search: 'bugesera nyamata',
  },
  {
    id: 'gatsibo',
    name: 'Gatsibo',
    subtitle: 'District · Eastern Province',
    latitude: -1.5581,
    longitude: 30.4345,
    search: 'gatsibo kabarore',
  },
  {
    id: 'kayonza',
    name: 'Kayonza',
    subtitle: 'District · Eastern Province',
    latitude: -1.9369,
    longitude: 30.5395,
    search: 'kayonza',
  },
  {
    id: 'kirehe',
    name: 'Kirehe',
    subtitle: 'District · Eastern Province',
    latitude: -2.2658,
    longitude: 30.5508,
    search: 'kirehe',
  },
  {
    id: 'ngoma',
    name: 'Ngoma',
    subtitle: 'District · Eastern Province',
    latitude: -2.2305,
    longitude: 30.6788,
    search: 'ngoma kibungo',
  },
  {
    id: 'nyagatare',
    name: 'Nyagatare',
    subtitle: 'District · Eastern Province',
    latitude: -1.3039,
    longitude: 30.3208,
    search: 'nyagatare',
  },
  {
    id: 'rwamagana',
    name: 'Rwamagana',
    subtitle: 'District · Eastern Province',
    latitude: -1.9556,
    longitude: 30.4337,
    search: 'rwamagana',
  },

  // Northern Province
  {
    id: 'burera',
    name: 'Burera',
    subtitle: 'District · Northern Province',
    latitude: -1.4679,
    longitude: 29.8432,
    search: 'burera kinoni',
  },
  {
    id: 'gakenke',
    name: 'Gakenke',
    subtitle: 'District · Northern Province',
    latitude: -1.6343,
    longitude: 29.7428,
    search: 'gakenke',
  },
  {
    id: 'gicumbi',
    name: 'Gicumbi',
    subtitle: 'District · Northern Province',
    latitude: -1.6789,
    longitude: 30.0675,
    search: 'gicumbi byumba',
  },
  {
    id: 'musanze',
    name: 'Musanze',
    subtitle: 'District · Northern Province',
    latitude: -1.4999,
    longitude: 29.6349,
    search: 'musanze ruhengeri volcanoes gorilla',
  },
  {
    id: 'nyabihu',
    name: 'Nyabihu',
    subtitle: 'District · Northern Province',
    latitude: -1.6789,
    longitude: 29.5569,
    search: 'nyabihu mukamira',
  },
  {
    id: 'rulindo',
    name: 'Rulindo',
    subtitle: 'District · Northern Province',
    latitude: -1.6789,
    longitude: 29.9089,
    search: 'rulindo bushoki',
  },

  // Southern Province
  {
    id: 'gisagara',
    name: 'Gisagara',
    subtitle: 'District · Southern Province',
    latitude: -2.4672,
    longitude: 29.6555,
    search: 'gisagara ndora',
  },
  {
    id: 'huye',
    name: 'Huye',
    subtitle: 'District · Southern Province',
    latitude: -2.6078,
    longitude: 29.7428,
    search: 'huye butare university south',
  },
  {
    id: 'kamonyi',
    name: 'Kamonyi',
    subtitle: 'District · Southern Province',
    latitude: -2.0735,
    longitude: 29.7516,
    search: 'kamonyi',
  },
  {
    id: 'muhanga',
    name: 'Muhanga',
    subtitle: 'District · Southern Province',
    latitude: -2.0735,
    longitude: 29.7516,
    search: 'muhanga gitarama',
  },
  {
    id: 'nyamagabe',
    name: 'Nyamagabe',
    subtitle: 'District · Southern Province',
    latitude: -2.4839,
    longitude: 29.5569,
    search: 'nyamagabe gasaka kaduha',
  },
  {
    id: 'nyanza',
    name: 'Nyanza',
    subtitle: 'District · Southern Province',
    latitude: -2.3516,
    longitude: 29.7409,
    search: 'nyanza ruhango',
  },
  {
    id: 'nyaruguru',
    name: 'Nyaruguru',
    subtitle: 'District · Southern Province',
    latitude: -2.6106,
    longitude: 29.6075,
    search: 'nyaruguru kibeho',
  },

  // Western Province
  {
    id: 'karongi',
    name: 'Karongi',
    subtitle: 'District · Western Province',
    latitude: -2.0035,
    longitude: 29.3589,
    search: 'karongi kibuye lake kivu',
  },
  {
    id: 'ngororero',
    name: 'Ngororero',
    subtitle: 'District · Western Province',
    latitude: -2.6449,
    longitude: 29.5569,
    search: 'ngororero',
  },
  {
    id: 'nyamasheke',
    name: 'Nyamasheke',
    subtitle: 'District · Western Province',
    latitude: -2.2025,
    longitude: 29.1184,
    search: 'nyamasheke kirambo',
  },
  {
    id: 'rubavu',
    name: 'Rubavu',
    subtitle: 'District · Western Province',
    latitude: -1.6939,
    longitude: 29.2589,
    search: 'rubavu gisenyi lake kivu',
  },
  {
    id: 'rusizi',
    name: 'Rusizi',
    subtitle: 'District · Western Province',
    latitude: -2.4845,
    longitude: 28.9069,
    search: 'rusizi cyangugu',
  },
  {
    id: 'rutsiro',
    name: 'Rutsiro',
    subtitle: 'District · Western Province',
    latitude: -1.9434,
    longitude: 29.4111,
    search: 'rutsiro mukura',
  },

  // Common city aliases (same areas people search for)
  {
    id: 'alias-butare',
    name: 'Butare (Huye)',
    subtitle: 'City · Huye District',
    latitude: -2.6078,
    longitude: 29.7428,
    search: 'butare huye',
  },
  {
    id: 'alias-gitarama',
    name: 'Gitarama (Muhanga)',
    subtitle: 'City · Muhanga District',
    latitude: -2.0735,
    longitude: 29.7516,
    search: 'gitarama muhanga',
  },
  {
    id: 'alias-gisenyi',
    name: 'Gisenyi (Rubavu)',
    subtitle: 'City · Rubavu District',
    latitude: -1.6939,
    longitude: 29.2589,
    search: 'gisenyi rubavu',
  },
  {
    id: 'alias-cyangugu',
    name: 'Cyangugu (Rusizi)',
    subtitle: 'City · Rusizi District',
    latitude: -2.4845,
    longitude: 28.9069,
    search: 'cyangugu rusizi',
  },
  {
    id: 'alias-ruhengeri',
    name: 'Ruhengeri (Musanze)',
    subtitle: 'City · Musanze District',
    latitude: -1.4999,
    longitude: 29.6349,
    search: 'ruhengeri musanze',
  },
  {
    id: 'alias-kibuye',
    name: 'Kibuye (Karongi)',
    subtitle: 'City · Karongi District',
    latitude: -2.0035,
    longitude: 29.3589,
    search: 'kibuye karongi',
  },
  {
    id: 'alias-byumba',
    name: 'Byumba (Gicumbi)',
    subtitle: 'Town · Gicumbi District',
    latitude: -1.6789,
    longitude: 30.0675,
    search: 'byumba gicumbi',
  },
];
