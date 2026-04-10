export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  password?: string; // Made optional for OAuth users
  profileImage?: string; // Made optional
  vehicleImage?: string;
  type: 'driver' | 'passenger';
  /** Unique driver ID for sign-in (e.g. D100001) — set when drivers register */
  driverNumber?: string;
  /** OAuth providers linked to this account (e.g., ['google:123456', 'apple:789012']) */
  oauthProviders?: string[];
  /** When the account was created */
  createdAt?: string;
  /** Driver vehicle — used for “nearby taxi” counts when the driver is online */
  vehicleType?: 'car' | 'motorbike';
  /** License plate — shown to passengers on map booking */
  vehiclePlate?: string;
  /** Vehicle make/model — shown to passengers on map booking */
  vehicleModel?: string;
  /** Average rating 1–5 (optional; set in Firebase when you add reviews) */
  averageRating?: number;
  /** Number of ratings contributing to averageRating */
  ratingCount?: number;
  /** Short bio — shown on profile */
  bio?: string;
  /** ICE — name (optional) */
  emergencyContactName?: string;
  /** ICE — phone (optional) */
  emergencyContactPhone?: string;
}