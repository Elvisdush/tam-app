export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  profileImage: string;
  vehicleImage?: string;
  type: 'driver' | 'passenger';
}