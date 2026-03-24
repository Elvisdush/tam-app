export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  profileImage: string;
  vehicleImage?: string;
  type: 'driver' | 'passenger';
  /** Driver vehicle — used for “nearby taxi” counts when the driver is online */
  vehicleType?: 'car' | 'motorbike';
  /** License plate — shown to passengers on map booking */
  vehiclePlate?: string;
  /** Vehicle make/model — shown to passengers on map booking */
  vehicleModel?: string;
}