export type OnlineDriverMarker = {
  userId: string;
  username?: string;
  latitude: number;
  longitude: number;
  transportType: 'car' | 'motorbike';
  updatedAt: number;
  isDemo?: boolean;
  vehiclePlate?: string;
  vehicleModel?: string;
  /** Demo drivers only — contact shown when no Firebase user match */
  demoPhone?: string;
  demoEmail?: string;
};
