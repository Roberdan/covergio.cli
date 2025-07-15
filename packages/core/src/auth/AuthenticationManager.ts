/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  OAuth2Config, 
  OAuth2Provider, 
  TokenResponse, 
  AuthState, 
  AuthSession,
  StoredTokens,
  AuthError,
  AuthErrorType,
  SessionConfig
} from './types';
import { OAuth2Client } from './oauth2/OAuth2Client';
import { JWTValidator, JWTValidationOptions } from './jwt/JWTValidator';
import { SessionManager } from './session/SessionManager';
import { TokenStorage } from './storage/TokenStorage';

/**
 * Authentication manager configuration
 */
export interface AuthenticationConfig {
  oauth2?: OAuth2Config;
  session?: SessionConfig;
  jwt?: {
    jwksUrl?: string;
    validationOptions?: JWTValidationOptions;
  };
  tokenStorage?: {
    storageDir?: string;
    encryptTokens?: boolean;
    encryptionPassword?: string;
  };
  providers?: Record<string, OAuth2Provider>;
  autoRefresh?: boolean;
  refreshThreshold?: number; // seconds
}

/**
 * Authentication flow result
 */
export interface AuthenticationResult {
  success: boolean;
  session?: AuthSession;
  error?: AuthError;
  requiresAction?: {
    type: 'redirect' | 'refresh' | 'login';
    url?: string;
    message?: string;
  };
}

/**
 * Comprehensive authentication manager
 * 
 * Provides complete OAuth 2.0 authentication with:
 * - Multiple provider support
 * - Secure token management
 * - Session lifecycle management
 * - JWT validation
 * - Automatic token refresh
 * - Security monitoring
 */
export class AuthenticationManager {
  private readonly config: AuthenticationConfig;
  private readonly oauth2Client?: OAuth2Client;
  private readonly jwtValidator: JWTValidator;
  private readonly sessionManager: SessionManager;
  private readonly tokenStorage: TokenStorage;
  private readonly providers: Map<string, OAuth2Provider> = new Map();
  private refreshPromises: Map<string, Promise<TokenResponse>> = new Map();

  constructor(config: AuthenticationConfig = {}) {
    this.config = config;

    // Initialize components
    this.jwtValidator = new JWTValidator();
    this.tokenStorage = new TokenStorage(config.tokenStorage);
    this.sessionManager = new SessionManager({
      ...config.session,
      jwtValidator: this.jwtValidator,
      tokenStorage: this.tokenStorage,
      enableAutoRefresh: config.autoRefresh,
      refreshThreshold: config.refreshThreshold
    });

    // Initialize OAuth2 client if configuration provided
    if (config.oauth2) {
      this.oauth2Client = new OAuth2Client(config.oauth2);
    }

    // Load providers
    if (config.providers) {
      for (const [name, provider] of Object.entries(config.providers)) {
        this.providers.set(name, provider);
      }
    }
  }

  /**
   * Start OAuth 2.0 authentication flow
   * 
   * @param provider - Provider name or OAuth2 config
   * @param options - Additional authentication options
   * @returns Authorization URL and state information
   */
  async startAuthentication(
    provider: string | OAuth2Config,
    options: {
      redirectUri?: string;
      scope?: string[];
      state?: string;
    } = {}
  ): Promise<{
    authorizationUrl: string;
    state: string;
    provider: string;
  }> {
    let oauth2Config: OAuth2Config;
    let providerName: string;

    if (typeof provider === 'string') {
      const providerConfig = this.providers.get(provider);
      if (!providerConfig) {
        throw this.createAuthError(
          AuthErrorType.INVALID_REQUEST,
          `Unknown provider: ${provider}`
        );
      }

      oauth2Config = {
        clientId: this.config.oauth2?.clientId || '',
        clientSecret: this.config.oauth2?.clientSecret,
        authorizationUrl: providerConfig.authorizationUrl,
        tokenUrl: providerConfig.tokenUrl,
        redirectUri: options.redirectUri || this.config.oauth2?.redirectUri || '',
        scope: options.scope || providerConfig.scopes,
        usePKCE: providerConfig.supportsPKCE
      };
      providerName = provider;
    } else {
      oauth2Config = provider;
      providerName = 'custom';
    }

    const client = new OAuth2Client(oauth2Config);
    const { url, state } = client.generateAuthorizationUrl({
      redirectUri: options.redirectUri,
      scope: options.scope
    });

    return {
      authorizationUrl: url,
      state,
      provider: providerName
    };
  }

  /**
   * Complete OAuth 2.0 authentication flow
   * 
   * @param provider - Provider name or OAuth2 config
   * @param code - Authorization code
   * @param state - State parameter
   * @param redirectUri - Redirect URI
   * @returns Authentication result
   */
  async completeAuthentication(
    provider: string | OAuth2Config,
    code: string,
    state: string,
    redirectUri?: string
  ): Promise<AuthenticationResult> {
    try {
      let oauth2Config: OAuth2Config;

      if (typeof provider === 'string') {
        const providerConfig = this.providers.get(provider);
        if (!providerConfig) {
          throw this.createAuthError(
            AuthErrorType.INVALID_REQUEST,
            `Unknown provider: ${provider}`
          );
        }

        oauth2Config = {
          clientId: this.config.oauth2?.clientId || '',
          clientSecret: this.config.oauth2?.clientSecret,
          authorizationUrl: providerConfig.authorizationUrl,
          tokenUrl: providerConfig.tokenUrl,
          redirectUri: redirectUri || this.config.oauth2?.redirectUri || '',
          usePKCE: providerConfig.supportsPKCE
        };
      } else {
        oauth2Config = provider;
      }

      const client = new OAuth2Client(oauth2Config);
      const tokenResponse = await client.exchangeCodeForTokens(code, state, redirectUri);

      // Convert to stored tokens format
      const storedTokens = this.convertToStoredTokens(tokenResponse);

      // Extract user ID from token
      const userId = await this.extractUserIdFromTokens(storedTokens);

      // Create session
      const session = await this.sessionManager.createSession(userId, storedTokens);

      return {
        success: true,
        session
      };
    } catch (error) {
      return {
        success: false,
        error: error as AuthError
      };
    }
  }

  /**
   * Get current authentication state
   * 
   * @param sessionId - Session identifier
   * @returns Authentication state
   */
  async getAuthenticationState(sessionId: string): Promise<AuthState> {
    return await this.sessionManager.getAuthState(sessionId);
  }

  /**
   * Refresh authentication tokens
   * 
   * @param sessionId - Session identifier
   * @returns Authentication result
   */
  async refreshTokens(sessionId: string): Promise<AuthenticationResult> {
    try {
      // Check if refresh is already in progress
      if (this.refreshPromises.has(sessionId)) {
        await this.refreshPromises.get(sessionId);
        const session = await this.sessionManager.getSession(sessionId);
        return { success: true, session: session || undefined };
      }

      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: this.createAuthError(AuthErrorType.SESSION_EXPIRED, 'Session not found'),
          requiresAction: { type: 'login', message: 'Please log in again' }
        };
      }

      if (!session.tokens.refreshToken) {
        return {
          success: false,
          error: this.createAuthError(AuthErrorType.INVALID_GRANT, 'No refresh token available'),
          requiresAction: { type: 'login', message: 'Please log in again' }
        };
      }

      // Start refresh process
      const refreshPromise = this.performTokenRefresh(session);
      this.refreshPromises.set(sessionId, refreshPromise);

      try {
        const newTokens = await refreshPromise;
        const storedTokens = this.convertToStoredTokens(newTokens);
        
        const updatedSession = await this.sessionManager.updateSessionTokens(sessionId, storedTokens);
        
        return {
          success: true,
          session: updatedSession
        };
      } finally {
        this.refreshPromises.delete(sessionId);
      }
    } catch (error) {
      this.refreshPromises.delete(sessionId);
      
      return {
        success: false,
        error: error as AuthError,
        requiresAction: { type: 'login', message: 'Token refresh failed, please log in again' }
      };
    }
  }

  /**
   * Logout and destroy session
   * 
   * @param sessionId - Session identifier
   * @returns Promise that resolves when logout is complete
   */
  async logout(sessionId: string): Promise<void> {
    const session = await this.sessionManager.getSession(sessionId);
    
    if (session && this.oauth2Client) {
      // Attempt to revoke tokens
      try {
        if (session.tokens.accessToken !== '[ENCRYPTED]') {
          await this.oauth2Client.revokeToken(session.tokens.accessToken, 'access_token');
        }
        
        if (session.tokens.refreshToken && session.tokens.refreshToken !== '[ENCRYPTED]') {
          await this.oauth2Client.revokeToken(session.tokens.refreshToken, 'refresh_token');
        }
      } catch (error) {
        // Token revocation failure is not critical
        console.warn('Token revocation failed during logout:', error);
      }
    }

    await this.sessionManager.deleteSession(sessionId);
  }

  /**
   * Logout all sessions for a user
   * 
   * @param userId - User identifier
   * @returns Promise that resolves when all sessions are logged out
   */
  async logoutUser(userId: string): Promise<void> {
    const sessions = await this.sessionManager.getUserSessions(userId);
    
    for (const session of sessions) {
      await this.logout(session.sessionId);
    }
  }

  /**
   * Validate JWT token
   * 
   * @param token - JWT token to validate
   * @param options - Validation options
   * @returns Validation result
   */
  async validateToken(token: string, options?: JWTValidationOptions) {
    if (this.config.jwt?.jwksUrl) {
      return await this.jwtValidator.validateJWTWithJWKS(
        token,
        this.config.jwt.jwksUrl,
        { ...this.config.jwt.validationOptions, ...options }
      );
    }

    throw new Error('JWT validation requires JWKS URL or public key');
  }

  /**
   * Check if session tokens need refresh
   * 
   * @param sessionId - Session identifier
   * @returns True if tokens should be refreshed
   */
  async shouldRefreshTokens(sessionId: string): Promise<boolean> {
    return await this.sessionManager.shouldRefreshTokens(sessionId);
  }

  /**
   * Get user sessions
   * 
   * @param userId - User identifier
   * @returns Array of user sessions
   */
  async getUserSessions(userId: string): Promise<AuthSession[]> {
    return await this.sessionManager.getUserSessions(userId);
  }

  /**
   * Add OAuth 2.0 provider
   * 
   * @param name - Provider name
   * @param provider - Provider configuration
   */
  addProvider(name: string, provider: OAuth2Provider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get available providers
   * 
   * @returns Array of provider names
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider configuration
   * 
   * @param name - Provider name
   * @returns Provider configuration
   */
  getProvider(name: string): OAuth2Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get authentication statistics
   * 
   * @returns Authentication statistics
   */
  getAuthStats() {
    return {
      sessionStats: this.sessionManager.getSessionStats(),
      providers: this.getProviders(),
      activeRefreshes: this.refreshPromises.size
    };
  }

  /**
   * Cleanup expired sessions and tokens
   * 
   * @returns Number of sessions cleaned up
   */
  async cleanup(): Promise<number> {
    return await this.sessionManager.cleanupExpiredSessions();
  }

  /**
   * Perform token refresh
   * 
   * @param session - Session to refresh
   * @returns New token response
   */
  private async performTokenRefresh(session: AuthSession): Promise<TokenResponse> {
    if (!this.oauth2Client) {
      throw this.createAuthError(
        AuthErrorType.INVALID_REQUEST,
        'OAuth2 client not configured'
      );
    }

    if (!session.tokens.refreshToken || session.tokens.refreshToken === '[ENCRYPTED]') {
      throw this.createAuthError(
        AuthErrorType.INVALID_GRANT,
        'No refresh token available'
      );
    }

    return await this.oauth2Client.refreshAccessToken(session.tokens.refreshToken);
  }

  /**
   * Convert token response to stored tokens format
   * 
   * @param tokenResponse - Token response from OAuth server
   * @returns Stored tokens format
   */
  private convertToStoredTokens(tokenResponse: TokenResponse): StoredTokens {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenType: tokenResponse.tokenType,
      expiresAt: now + tokenResponse.expiresIn,
      scope: tokenResponse.scope,
      idToken: tokenResponse.idToken,
      createdAt: now
    };
  }

  /**
   * Extract user ID from tokens
   * 
   * @param tokens - Token data
   * @returns User identifier
   */
  private async extractUserIdFromTokens(tokens: StoredTokens): Promise<string> {
    if (tokens.idToken) {
      try {
        const { payload } = this.jwtValidator.parseJWT(tokens.idToken);
        return payload.sub;
      } catch (error) {
        console.warn('Failed to extract user ID from ID token:', error);
      }
    }

    // Fallback to access token
    if (tokens.accessToken && tokens.accessToken !== '[ENCRYPTED]') {
      try {
        const { payload } = this.jwtValidator.parseJWT(tokens.accessToken);
        return payload.sub;
      } catch (error) {
        // Access token might not be a JWT
      }
    }

    // Generate a temporary user ID
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create authentication error
   * 
   * @param type - Error type
   * @param message - Error message
   * @returns Authentication error
   */
  private createAuthError(type: AuthErrorType, message: string): AuthError {
    const error = new Error(message) as AuthError;
    error.name = 'AuthError';
    error.type = type;
    return error;
  }
}