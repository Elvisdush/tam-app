import { User } from '@/types/user';

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'Ngoga',
    email: 'ngoga@example.com',
    phone: '0783123456',
    password: 'password123',
    profileImage: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop',
    vehicleImage: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=1470&auto=format&fit=crop',
    type: 'driver',
  },
  {
    id: '2',
    username: 'Kamanzi',
    email: 'kamanzi@example.com',
    phone: '0783654321',
    password: 'password123',
    profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=1480&auto=format&fit=crop',
    vehicleImage: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=1470&auto=format&fit=crop',
    type: 'driver',
  },
  {
    id: '3',
    username: 'Gatera',
    email: 'gatera@example.com',
    phone: '0783987654',
    password: 'password123',
    profileImage: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=1374&auto=format&fit=crop',
    type: 'passenger',
  },
  {
    id: '4',
    username: 'Sibomana',
    email: 'sibomana@example.com',
    phone: '0783456789',
    password: 'password123',
    profileImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=1522&auto=format&fit=crop',
    type: 'passenger',
  },
];