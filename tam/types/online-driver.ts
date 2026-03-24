export type OnlineDriverMarker = {
  userId: string;
  username?: string;
  latitude: number;
  longitude: number;
  transportType: 'car' | 'motorbike';
  updatedAt: number;
  isDemo?: boolean;
};
