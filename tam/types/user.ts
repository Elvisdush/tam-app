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
}