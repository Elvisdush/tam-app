/**
 * HTTP reverse geocode (BigDataCloud client) — works when Android's system Geocoder is UNAVAILABLE.
 */

const BDC_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export type BdcAdministrativeEntry = {
  name: string;
  description?: string;
  adminLevel?: number;
  order?: number;
};

export type BigDataCloudReverseGeo = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  localityInfo?: {
    administrative?: BdcAdministrativeEntry[];
  };
};

export async function fetchBigDataCloudReverseGeo(
  latitude: number,
  longitude: number
): Promise<BigDataCloudReverseGeo | null> {
  try {
    const response = await fetch(
      `${BDC_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (!response.ok) return null;
    return (await response.json()) as BigDataCloudReverseGeo;
  } catch {
    return null;
  }
}

/** Rwanda (and similar) “sector” / umurenge from BigDataCloud administrative hierarchy */
export function extractSectorFromBdc(data: BigDataCloudReverseGeo): string | undefined {
  const admins = data.localityInfo?.administrative;
  if (!admins?.length) return undefined;
  const byDesc = admins.find((a) => {
    const d = (a.description ?? '').toLowerCase();
    return d.includes('sector') || d.includes('umurenge');
  });
  if (byDesc?.name?.trim()) return byDesc.name.trim();
  const level8 = [...admins]
    .filter((a) => a.adminLevel === 8)
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  return level8[0]?.name?.trim();
}

function uniqPlaceParts(parts: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p?.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function basicAddressLineFromBdc(data: BigDataCloudReverseGeo): string | undefined {
  if (data.locality || data.city || data.principalSubdivision) {
    return `${data.locality || data.city || ''} ${data.principalSubdivision || ''}`.trim();
  }
  return undefined;
}

export function formatAddressLineFromBdc(data: BigDataCloudReverseGeo): string | undefined {
  return basicAddressLineFromBdc(data);
}

/**
 * Single place line: sector (when known) · locality/city · province — for “my location” and map labels.
 */
export function formatPlaceLineWithSectorFromBdc(data: BigDataCloudReverseGeo): string | undefined {
  try {
    const sector = extractSectorFromBdc(data);
    const loc = (data.locality || data.city || '').trim();
    const sub = (data.principalSubdivision || '').trim();
    const parts = uniqPlaceParts([sector, loc, sub]);
    if (parts.length > 0) return parts.join(' · ');
    return basicAddressLineFromBdc(data);
  } catch {
    return basicAddressLineFromBdc(data);
  }
}

export async function reverseGeocodePlaceLine(
  latitude: number,
  longitude: number
): Promise<string | undefined> {
  const data = await fetchBigDataCloudReverseGeo(latitude, longitude);
  if (!data) return undefined;
  return formatPlaceLineWithSectorFromBdc(data);
}
