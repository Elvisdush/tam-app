/** Encode lat/lng points as Google/OSRM precision-5 polyline (inverse of decodePolyline). */
export function encodePolyline(points: Array<{ latitude: number; longitude: number }>): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';
  for (const p of points) {
    const lat = Math.round(p.latitude * 1e5);
    const lng = Math.round(p.longitude * 1e5);
    const dLat = lat - lastLat;
    const dLng = lng - lastLng;
    lastLat = lat;
    lastLng = lng;
    result += encodeSigned(dLat) + encodeSigned(dLng);
  }
  return result;
}

function encodeSigned(num: number): string {
  let sgn = num < 0 ? ~(num << 1) : num << 1;
  let chunk = '';
  while (sgn >= 0x20) {
    chunk += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  chunk += String.fromCharCode(sgn + 63);
  return chunk;
}

/** Decode Google encoded polyline into lat/lng coordinates */
export function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
}
