import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../models/ride_model.dart';

/// Live map for ride tracking — parity with [tam/components/RideTrackingMap.tsx] (simplified).
class RideTrackingMap extends StatelessWidget {
  const RideTrackingMap({
    super.key,
    required this.ride,
    this.driverLocation,
    this.passengerLocation,
  });

  final RideModel ride;
  final LiveLocation? driverLocation;
  final LiveLocation? passengerLocation;

  @override
  Widget build(BuildContext context) {
    final pickup = ride.pickupLocation;
    final center = pickup != null
        ? LatLng(pickup.latitude, pickup.longitude)
        : (driverLocation != null
            ? LatLng(driverLocation!.latitude, driverLocation!.longitude)
            : const LatLng(-1.9441, 30.0619));

    return GoogleMap(
      initialCameraPosition: CameraPosition(target: center, zoom: 13),
      markers: {
        if (pickup != null)
          Marker(
            markerId: const MarkerId('pickup'),
            position: LatLng(pickup.latitude, pickup.longitude),
            infoWindow: const InfoWindow(title: 'Pickup'),
          ),
        if (driverLocation != null)
          Marker(
            markerId: const MarkerId('driver'),
            position: LatLng(driverLocation!.latitude, driverLocation!.longitude),
            infoWindow: const InfoWindow(title: 'Driver'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          ),
        if (passengerLocation != null)
          Marker(
            markerId: const MarkerId('passenger'),
            position: LatLng(passengerLocation!.latitude, passengerLocation!.longitude),
            infoWindow: const InfoWindow(title: 'Passenger'),
            icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
          ),
      },
    );
  }
}
