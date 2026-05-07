/**
 * Authentication and Authorization System
 * JWT-based authentication with role-based access control
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: 'user' | 'driver' | 'admin' | 'super_admin';
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  tokenType: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export class AuthSystem {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly bcryptRounds: number;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
    this.bcryptRounds = 12;

    // Ensure secrets are set
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️ JWT_SECRET not set, using random secret (restart will invalidate all tokens)');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user: User): AuthToken {
    const accessTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      tokenType: 'access'
    };

    const refreshTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      ...accessTokenPayload,
      tokenType: 'refresh'
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'tam-app',
      audience: 'tam-app-users'
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'tam-app',
      audience: 'tam-app-users'
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'tam-app',
        audience: 'tam-app-users'
      }) as JWTPayload;

      if (decoded.tokenType !== 'access') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'tam-app',
        audience: 'tam-app-users'
      }) as JWTPayload;

      if (decoded.tokenType !== 'refresh') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.role === 'super_admin';
  }

  /**
   * Check if user has role
   */
  hasRole(user: User, role: string): boolean {
    return user.role === role || user.role === 'super_admin';
  }

  /**
   * Get user permissions based on role
   */
  getRolePermissions(role: string): string[] {
    const rolePermissions = {
      user: ['read_own_profile', 'update_own_profile', 'search_places', 'create_trip'],
      driver: ['read_own_profile', 'update_own_profile', 'search_places', 'create_trip', 'accept_trip', 'update_trip_status'],
      admin: ['read_all_profiles', 'manage_users', 'view_analytics', 'manage_system'],
      super_admin: ['*'] // All permissions
    };

    return rolePermissions[role as keyof typeof rolePermissions] || [];
  }

  /**
   * Create user with hashed password
   */
  async createUser(userData: {
    email: string;
    password: string;
    phone?: string;
    role?: string;
  }): Promise<Omit<User, 'password'>> {
    const hashedPassword = await this.hashPassword(userData.password);
    const permissions = this.getRolePermissions(userData.role || 'user');

    const user: User = {
      id: crypto.randomUUID(),
      email: userData.email,
      phone: userData.phone,
      role: userData.role as any || 'user',
      permissions,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In production, save user to database
    console.log(`👤 Created user: ${user.email} with role: ${user.role}`);
    
    // Return user without sensitive data
    const { ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    // In production, fetch user from database
    // For now, simulate user lookup
    console.log(`🔐 Authenticating user: ${email}`);
    
    // Mock authentication - replace with database lookup
    if (email === 'admin@tam.com' && password === 'admin123') {
      return {
        id: 'admin-123',
        email: 'admin@tam.com',
        role: 'admin',
        permissions: this.getRolePermissions('admin'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return null;
  }

  /**
   * Generate API key for user
   */
  generateApiKey(user: User): {
    keyId: string;
    apiKey: string;
    permissions: string[];
  } {
    const keyId = crypto.randomUUID();
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // In production, store keyHash in database
    console.log(`🔑 Generated API key for user ${user.id}: ${keyId}`);

    return {
      keyId,
      apiKey,
      permissions: user.permissions
    };
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey: string): {
    userId: string;
    permissions: string[];
  } | null {
    // In production, verify against database
    // For now, mock verification
    if (apiKey === 'mock-api-key-123') {
      return {
        userId: 'user-123',
        permissions: ['read_own_profile', 'search_places']
      };
    }

    return null;
  }
}

// Global auth system instance
export const authSystem = new AuthSystem();

// Role-based permissions
export const PERMISSIONS = {
  // User permissions
  READ_OWN_PROFILE: 'read_own_profile',
  UPDATE_OWN_PROFILE: 'update_own_profile',
  
  // Location permissions
  SEARCH_PLACES: 'search_places',
  READ_PLACE_DETAILS: 'read_place_details',
  
  // Trip permissions
  CREATE_TRIP: 'create_trip',
  READ_OWN_TRIPS: 'read_own_trips',
  UPDATE_OWN_TRIPS: 'update_own_trips',
  
  // Driver permissions
  ACCEPT_TRIP: 'accept_trip',
  UPDATE_TRIP_STATUS: 'update_trip_status',
  READ_DRIVER_PROFILE: 'read_driver_profile',
  
  // Admin permissions
  READ_ALL_PROFILES: 'read_all_profiles',
  MANAGE_USERS: 'manage_users',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_SYSTEM: 'manage_system',
  
  // Super admin permissions
  ALL_PERMISSIONS: '*'
} as const;

// Role hierarchy
export const ROLE_HIERARCHY = {
  user: 1,
  driver: 2,
  admin: 3,
  super_admin: 4
} as const;
