/**
 * Google Places (New) autocomplete + details. Used from native clients and from the tRPC proxy (web).
 */

export interface LocationSuggestion {
  /** Stable key when suggestions come from local data */
  id?: string;
  name: string;
  address: string;
  distance: string;
  time: string;
  latitude: number;
  longitude: number;
}

export interface SearchPlacesParams {
  query: string;
  userLat: number;
  userLng: number;
  apiKey: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function searchPlacesSuggestions(params: SearchPlacesParams): Promise<LocationSuggestion[]> {
  const { query, userLat, userLng, apiKey } = params;
  if (!apiKey) return [];

  const autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.mainText',
    },
    body: JSON.stringify({
      input: query,
      languageCode: 'en',
      includedRegionCodes: ['rw'],
      locationBias: {
        circle: {
          center: { latitude: userLat, longitude: userLng },
          radius: 50000.0,
        },
      },
    }),
  });

  const autocompleteData = await autocompleteResponse.json();

  if (!autocompleteResponse.ok || !autocompleteData.suggestions?.length) {
    return [];
  }

  const placePredictions = autocompleteData.suggestions.filter(
    (s: { placePrediction?: { place?: string } }) => s.placePrediction?.place
  );

  if (placePredictions.length === 0) return [];

  const suggestionsWithDetails = await Promise.all(
    placePredictions.slice(0, 5).map(async (item: { placePrediction: Record<string, unknown> }) => {
      try {
        const pred = item.placePrediction as {
          place: string;
          mainText?: { text?: string };
          text?: { text?: string };
        };
        const placeResource = pred.place;
        const placeId = placeResource.startsWith('places/') ? placeResource.slice(7) : placeResource;

        const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,viewport',
          },
        });

        const placeDetails = await detailsResponse.json();
        if (!detailsResponse.ok) return null;

        let destLat: number | null = null;
        let destLng: number | null = null;

        const loc = placeDetails.location as { latitude?: number; longitude?: number; lat?: number; lng?: number } | undefined;
        if (loc) {
          destLat = loc.latitude ?? loc.lat ?? null;
          destLng = loc.longitude ?? loc.lng ?? null;
        }
        if ((destLat == null || destLng == null) && placeDetails.viewport) {
          const v = placeDetails.viewport as {
            low?: { latitude: number; longitude: number };
            high?: { latitude: number; longitude: number };
            southwest?: { latitude: number; longitude: number };
            northeast?: { latitude: number; longitude: number };
          };
          const low = v.low ?? v.southwest;
          const high = v.high ?? v.northeast;
          if (low && high) {
            destLat = (low.latitude + high.latitude) / 2;
            destLng = (low.longitude + high.longitude) / 2;
          }
        }
        if (destLat == null || destLng == null) return null;

        const distance = calculateDistance(userLat, userLng, destLat, destLng);
        const time = Math.ceil((distance / 40) * 60);
        const displayName = placeDetails.displayName as { text?: string } | undefined;
        const name =
          displayName?.text ?? (pred.mainText as { text?: string } | undefined)?.text ?? (pred.text as { text?: string } | undefined)?.text ?? 'Place';
        const address = (placeDetails.formattedAddress as string | undefined) ?? (pred.text as { text?: string } | undefined)?.text ?? '';

        return {
          name,
          address,
          distance: `${distance.toFixed(1)} km`,
          time: `${time} min`,
          latitude: destLat,
          longitude: destLng,
        };
      } catch {
        return null;
      }
    })
  );

  return suggestionsWithDetails.filter((s): s is LocationSuggestion => s !== null);
}
