/// Parity with [tam/constants/kigali-destinations.ts]
const kigaliDestinationIds = {
  'kigali-city',
  'gasabo',
  'kicukiro',
  'nyarugenge',
};

bool isKigaliDestination(String destinationId) =>
    kigaliDestinationIds.contains(destinationId);

/// Approximate bbox for Kigali City — taxi moto pickup zone.
const double kigaliMinLat = -2.06;
const double kigaliMaxLat = -1.87;
const double kigaliMinLng = 29.95;
const double kigaliMaxLng = 30.22;

bool isCoordinateInKigaliCity(double latitude, double longitude) {
  if (!latitude.isFinite || !longitude.isFinite) return false;
  return latitude >= kigaliMinLat &&
      latitude <= kigaliMaxLat &&
      longitude >= kigaliMinLng &&
      longitude <= kigaliMaxLng;
}
