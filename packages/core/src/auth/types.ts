/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * OAuth 2.0 configuration
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret?: string; // Optional for PKCE flow
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scope?: string[];
  state?: string;
  usePKCE?: boolean;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

/**
 * PKCE (Proof Key for Code Exchange) parameters
 */
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
}

/**
 * OAuth 2.0 authorization request parameters
 */
export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope?: string[];
  state?: string;
  responseType: 'code';
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

/**
 * OAuth 2.0 token exchange request
 */
export interface TokenRequest {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
  refreshToken?: string;
}

/**
 * OAuth 2.0 token response
 */
export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken?: string;
  scope?: string;
  idToken?: string; // For OpenID Connect
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  iss: string; // Issuer
  sub: string; // Subject
  aud: string | string[]; // Audience
  exp: number; // Expiration time
  iat: number; // Issued at
  nbf?: number; // Not before
  jti?: string; // JWT ID
  scope?: string; // Granted scopes
  [key: string]: any; // Additional claims
}

/**
 * JWT header structure
 */
export interface JWTHeader {
  alg: string; // Algorithm
  typ: 'JWT';
  kid?: string; // Key ID
}

/**
 * Stored token information
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresAt: number; // Unix timestamp
  scope?: string;
  idToken?: string;
  createdAt: number; // Unix timestamp
}

/**
 * Authentication session information
 */
export interface AuthSession {
  userId: string;
  tokens: StoredTokens;
  lastActivity: number; // Unix timestamp
  sessionId: string;
  deviceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email?: string;
    name?: string;
    [key: string]: any;
  };
  session?: AuthSession;
  permissions?: string[];
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  payload?: JWTPayload;
  errors: string[];
  warnings: string[];
  expiresAt?: number;
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  INVALID_GRANT = 'invalid_grant',
  INVALID_CLIENT = 'invalid_client',
  INVALID_REQUEST = 'invalid_request',
  UNAUTHORIZED_CLIENT = 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE = 'unsupported_grant_type',
  INVALID_SCOPE = 'invalid_scope',
  ACCESS_DENIED = 'access_denied',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  SESSION_EXPIRED = 'session_expired',
  NETWORK_ERROR = 'network_error'
}

/**
 * Authentication error
 */
export interface AuthError extends Error {
  type: AuthErrorType;
  description?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

/**
 * OAuth 2.0 provider configuration
 */
export interface OAuth2Provider {
  name: string;
  displayName: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  jwksUrl?: string; // JSON Web Key Set URL
  issuer?: string;
  scopes: string[];
  supportsRefreshToken: boolean;
  supportsPKCE: boolean;
  requiresClientSecret: boolean;
}

/**
 * Session configuration
 */
export interface SessionConfig {
  maxAge: number; // Session lifetime in seconds
  inactivityTimeout: number; // Inactivity timeout in seconds
  renewalThreshold: number; // Token renewal threshold in seconds
  cookieName?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}