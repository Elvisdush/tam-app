/**
 * Authentication and Authorization System (JavaScript)
 * JWT-based authentication with role-based access control
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class AuthSystem {
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
  async hashPassword(password) {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user) {
    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      tokenType: 'access'
    };

    const refreshTokenPayload = {
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
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'tam-app',
        audience: 'tam-app-users'
      });

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
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'tam-app',
        audience: 'tam-app-users'
      });

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
  hasPermission(user, permission) {
    return user.permissions.includes(permission) || user.role === 'super_admin';
  }

  /**
   * Check if user has role
   */
  hasRole(user, role) {
    return user.role === role || user.role === 'super_admin';
  }

  /**
   * Get user permissions based on role
   */
  getRolePermissions(role) {
    const rolePermissions = {
      user: ['read_own_profile', 'update_own_profile', 'search_places', 'create_trip'],
      driver: ['read_own_profile', 'update_own_profile', 'search_places', 'create_trip', 'accept_trip', 'update_trip_status'],
      admin: ['read_all_profiles', 'manage_users', 'view_analytics', 'manage_system'],
      super_admin: ['*'] // All permissions
    };

    return rolePermissions[role] || [];
  }

  /**
   * Create user with hashed password
   */
  async createUser(userData) {
    const hashedPassword = await this.hashPassword(userData.password);
    const permissions = this.getRolePermissions(userData.role || 'user');

    const user = {
      id: crypto.randomUUID(),
      email: userData.email,
      phone: userData.phone,
      role: userData.role || 'user',
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
  async authenticateUser(email, password) {
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

    if (email === 'user@tam.com' && password === 'user123') {
      return {
        id: 'user-123',
        email: 'user@tam.com',
        role: 'user',
        permissions: this.getRolePermissions('user'),
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
  generateApiKey(user) {
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
  verifyApiKey(apiKey) {
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
const authSystem = new AuthSystem();

// Role-based permissions
const PERMISSIONS = {
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
};

// Role hierarchy
const ROLE_HIERARCHY = {
  user: 1,
  driver: 2,
  admin: 3,
  super_admin: 4
};

module.exports = {
  authSystem,
  PERMISSIONS,
  ROLE_HIERARCHY
};
