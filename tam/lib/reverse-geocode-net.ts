/**
 * HTTP reverse geocode (BigDataCloud client) — works when Android's system Geocoder is UNAVAILABLE.
 */

const BDC_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

export type BigDataCloudReverseGeo = {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
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

export function formatAddressLineFromBdc(data: BigDataCloudReverseGeo): string | undefined {
  if (data.locality || data.city || data.principalSubdivision) {
    return `${data.locality || data.city || ''} ${data.principalSubdivision || ''}`.trim();
  }
  return undefined;
}
