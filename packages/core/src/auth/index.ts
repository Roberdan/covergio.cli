/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Main Authentication Manager
export { AuthenticationManager } from './AuthenticationManager';
export type { 
  AuthenticationConfig, 
  AuthenticationResult 
} from './AuthenticationManager';

// Core Types
export type {
  OAuth2Config,
  PKCEParams,
  AuthorizationRequest,
  TokenRequest,
  TokenResponse,
  JWTPayload,
  JWTHeader,
  StoredTokens,
  AuthSession,
  AuthState,
  TokenValidationResult,
  AuthError,
  OAuth2Provider,
  SessionConfig
} from './types';

export { AuthErrorType } from './types';

// OAuth 2.0 Components
export { OAuth2Client } from './oauth2/OAuth2Client';
export { PKCEGenerator } from './oauth2/PKCEGenerator';

// JWT Components
export { JWTValidator } from './jwt/JWTValidator';
export type { 
  JWK, 
  JWKS, 
  JWTValidationOptions 
} from './jwt/JWTValidator';

// Session Management
export { SessionManager } from './session/SessionManager';
export type { 
  SessionManagerConfig,
  SessionActivity 
} from './session/SessionManager';

// Token Storage
export { TokenStorage } from './storage/TokenStorage';
export type { TokenStorageConfig } from './storage/TokenStorage';

/**
 * Common OAuth 2.0 providers configuration
 */
export const OAUTH2_PROVIDERS = {
  auth0: {
    name: 'auth0',
    displayName: 'Auth0',
    authorizationUrl: 'https://{domain}/authorize',
    tokenUrl: 'https://{domain}/oauth/token',
    userInfoUrl: 'https://{domain}/userinfo',
    jwksUrl: 'https://{domain}/.well-known/jwks.json',
    scopes: ['openid', 'profile', 'email'],
    supportsRefreshToken: true,
    supportsPKCE: true,
    requiresClientSecret: false
  },
  google: {
    name: 'google',
    displayName: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: 'https://accounts.google.com',
    scopes: ['openid', 'profile', 'email'],
    supportsRefreshToken: true,
    supportsPKCE: true,
    requiresClientSecret: false
  },
  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    issuer: 'https://login.microsoftonline.com/{tenantid}/v2.0',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    supportsRefreshToken: true,
    supportsPKCE: true,
    requiresClientSecret: false
  },
  github: {
    name: 'github',
    displayName: 'GitHub',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user', 'user:email'],
    supportsRefreshToken: false,
    supportsPKCE: false,
    requiresClientSecret: true
  },
  okta: {
    name: 'okta',
    displayName: 'Okta',
    authorizationUrl: 'https://{domain}/oauth2/default/v1/authorize',
    tokenUrl: 'https://{domain}/oauth2/default/v1/token',
    userInfoUrl: 'https://{domain}/oauth2/default/v1/userinfo',
    jwksUrl: 'https://{domain}/oauth2/default/v1/keys',
    scopes: ['openid', 'profile', 'email'],
    supportsRefreshToken: true,
    supportsPKCE: true,
    requiresClientSecret: false
  }
} as const;

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG = {
  session: {
    maxAge: 24 * 60 * 60, // 24 hours
    inactivityTimeout: 2 * 60 * 60, // 2 hours
    renewalThreshold: 5 * 60, // 5 minutes
    secure: true,
    httpOnly: true,
    sameSite: 'strict' as const
  },
  autoRefresh: true,
  refreshThreshold: 5 * 60, // 5 minutes
  tokenStorage: {
    encryptTokens: true
  }
} as const;

/**
 * Authentication utility functions
 */
export const AuthUtils = {
  /**
   * Check if token is expired
   * 
   * @param expiresAt - Token expiration timestamp (seconds)
   * @param bufferSeconds - Buffer time before considering expired
   * @returns True if token is expired
   */
  isTokenExpired(expiresAt: number, bufferSeconds: number = 60): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= (expiresAt - bufferSeconds);
  },

  /**
   * Generate secure random string
   * 
   * @param length - String length
   * @returns Random string
   */
  generateRandomString(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomArray = new Uint8Array(length);
    crypto.getRandomValues(randomArray);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomArray[i] % chars.length);
    }
    
    return result;
  },

  /**
   * Parse JWT without verification (for inspection only)
   * 
   * @param token - JWT token
   * @returns Parsed token components
   */
  parseJWT(token: string): { header: any; payload: any } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    return { header, payload };
  },

  /**
   * Get time until token expiration
   * 
   * @param expiresAt - Token expiration timestamp (seconds)
   * @returns Time until expiration in seconds (negative if expired)
   */
  getTimeUntilExpiration(expiresAt: number): number {
    const now = Math.floor(Date.now() / 1000);
    return expiresAt - now;
  },

  /**
   * Format error message for display
   * 
   * @param error - Authentication error
   * @returns User-friendly error message
   */
  formatAuthError(error: AuthError): string {
    const errorMessages: Record<AuthErrorType, string> = {
      [AuthErrorType.INVALID_GRANT]: 'Authentication failed. Please try again.',
      [AuthErrorType.INVALID_CLIENT]: 'Application configuration error. Please contact support.',
      [AuthErrorType.INVALID_REQUEST]: 'Invalid request. Please try again.',
      [AuthErrorType.UNAUTHORIZED_CLIENT]: 'This application is not authorized. Please contact support.',
      [AuthErrorType.UNSUPPORTED_GRANT_TYPE]: 'Authentication method not supported.',
      [AuthErrorType.INVALID_SCOPE]: 'Invalid permissions requested.',
      [AuthErrorType.ACCESS_DENIED]: 'Access was denied. Please try again.',
      [AuthErrorType.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [AuthErrorType.TOKEN_INVALID]: 'Invalid authentication token. Please log in again.',
      [AuthErrorType.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
      [AuthErrorType.NETWORK_ERROR]: 'Network error. Please check your connection and try again.'
    };

    return errorMessages[error.type] || error.message || 'An authentication error occurred.';
  }
} as const;