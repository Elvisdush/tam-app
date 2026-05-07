"use strict";
/**
 * Google Places (New) autocomplete + details. Used from native clients and from the tRPC proxy (web).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPlacesSuggestions = searchPlacesSuggestions;
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
async function searchPlacesSuggestions(params) {
    const { query, userLat, userLng, apiKey } = params;
    if (!apiKey)
        return [];
    const autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.mainText',
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
    const placePredictions = autocompleteData.suggestions.filter((s) => s.placePrediction?.place);
    if (placePredictions.length === 0)
        return [];
    const suggestionsWithDetails = await Promise.all(placePredictions.slice(0, 5).map(async (item) => {
        try {
            const pred = item.placePrediction;
            const placeResource = pred.place;
            const placeId = placeResource.startsWith('places/') ? placeResource.slice(7) : placeResource;
            const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,viewport',
                },
            });
            const placeDetails = await detailsResponse.json();
            if (!detailsResponse.ok)
                return null;
            let destLat = null;
            let destLng = null;
            const loc = placeDetails.location;
            if (loc) {
                destLat = loc.latitude ?? loc.lat ?? null;
                destLng = loc.longitude ?? loc.lng ?? null;
            }
            if ((destLat == null || destLng == null) && placeDetails.viewport) {
                const v = placeDetails.viewport;
                const low = v.low ?? v.southwest;
                const high = v.high ?? v.northeast;
                if (low && high) {
                    destLat = (low.latitude + high.latitude) / 2;
                    destLng = (low.longitude + high.longitude) / 2;
                }
            }
            if (destLat == null || destLng == null)
                return null;
            const distance = calculateDistance(userLat, userLng, destLat, destLng);
            const time = Math.ceil((distance / 40) * 60);
            const displayName = placeDetails.displayName;
            const name = displayName?.text ?? pred.mainText?.text ?? pred.text?.text ?? 'Place';
            const address = placeDetails.formattedAddress ?? pred.text?.text ?? '';
            return {
                name,
                address,
                distance: `${distance.toFixed(1)} km`,
                time: `${time} min`,
                latitude: destLat,
                longitude: destLng,
            };
        }
        catch {
            return null;
        }
    }));
    return suggestionsWithDetails.filter((s) => s !== null);
}
