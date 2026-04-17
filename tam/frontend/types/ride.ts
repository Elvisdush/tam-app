export interface LiveLocation {
  latitude: number;
  longitude: number;
  timestamp: string;
  address?: string;
}

export interface RideLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Ride {
  id: number | string;
  /** Firebase Realtime Database key - use for location updates when id is from push() */
  firebaseKey?: string;
  from: string;
  to: string;
  price: number;
  transportType: 'car' | 'motorbike';
  driverId: string | null;
  passengerId: string | null;
  status: 'pending' | 'scheduled' | 'accepted' | 'completed' | 'cancelled';
  createdAt: string;
  /** When the passenger requested pickup (ISO) — set for “book later” from map */
  scheduledPickupAt?: string;
  /** Pickup coordinates (from location) */
  pickupLocation?: RideLocation;
  /** Dropoff coordinates (to location) */
  dropoffLocation?: RideLocation;
  /** Live driver position - updated in real-time */
  driverLocation?: LiveLocation;
  /** Live passenger position - updated in real-time */
  passengerLocation?: LiveLocation;
}