/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from 'crypto';
import { 
  OAuth2Config, 
  AuthorizationRequest, 
  TokenRequest, 
  TokenResponse, 
  AuthError, 
  AuthErrorType,
  PKCEParams
} from '../types';
import { PKCEGenerator } from './PKCEGenerator';
import { SecureHttpClient } from '../../security/transport/SecureHttpClient';

/**
 * OAuth 2.0 client implementation
 * 
 * Implements secure OAuth 2.0 flows including:
 * - Authorization Code flow with PKCE
 * - Refresh token flow
 * - State parameter for CSRF protection
 * - Secure token exchange
 */
export class OAuth2Client {
  private readonly config: OAuth2Config;
  private readonly httpClient: SecureHttpClient;
  private readonly pendingStates: Map<string, { 
    codeVerifier?: string; 
    createdAt: number; 
    redirectUri: string;
  }> = new Map();

  constructor(config: OAuth2Config) {
    this.config = config;
    this.httpClient = new SecureHttpClient();
    
    // Start cleanup timer for expired states
    this.startStateCleanupTimer();
  }

  /**
   * Generate authorization URL for OAuth 2.0 flow
   * 
   * @param additionalParams - Additional parameters for authorization request
   * @returns Authorization URL and state parameter
   */
  generateAuthorizationUrl(additionalParams: Partial<AuthorizationRequest> = {}): {
    url: string;
    state: string;
    codeVerifier?: string;
  } {
    const state = PKCEGenerator.generateState();
    let codeVerifier: string | undefined;
    let pkceParams: PKCEParams | undefined;

    // Generate PKCE parameters if enabled
    if (this.config.usePKCE) {
      pkceParams = PKCEGenerator.generatePKCE('S256');
      codeVerifier = pkceParams.codeVerifier;
    }

    // Store state for validation
    this.pendingStates.set(state, {
      codeVerifier,
      createdAt: Date.now(),
      redirectUri: additionalParams.redirectUri || this.config.redirectUri
    });

    // Build authorization request parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: additionalParams.redirectUri || this.config.redirectUri,
      state,
      ...additionalParams
    });

    // Add scope if provided
    const scopes = additionalParams.scope || this.config.scope;
    if (scopes && scopes.length > 0) {
      params.set('scope', scopes.join(' '));
    }

    // Add PKCE parameters if enabled
    if (pkceParams) {
      params.set('code_challenge', pkceParams.codeChallenge);
      params.set('code_challenge_method', pkceParams.codeChallengeMethod);
    }

    const url = `${this.config.authorizationUrl}?${params.toString()}`;

    return {
      url,
      state,
      codeVerifier
    };
  }

  /**
   * Exchange authorization code for tokens
   * 
   * @param code - Authorization code from callback
   * @param state - State parameter from callback
   * @param redirectUri - Redirect URI used in authorization request
   * @returns Token response
   */
  async exchangeCodeForTokens(
    code: string, 
    state: string, 
    redirectUri?: string
  ): Promise<TokenResponse> {
    // Validate state parameter
    const stateData = this.pendingStates.get(state);
    if (!stateData) {
      throw this.createAuthError(
        AuthErrorType.INVALID_REQUEST,
        'Invalid or expired state parameter'
      );
    }

    // Check state expiration (15 minutes)
    const stateAge = Date.now() - stateData.createdAt;
    if (stateAge > 15 * 60 * 1000) {
      this.pendingStates.delete(state);
      throw this.createAuthError(
        AuthErrorType.INVALID_REQUEST,
        'State parameter has expired'
      );
    }

    // Use stored redirect URI if not provided
    const finalRedirectUri = redirectUri || stateData.redirectUri;

    // Build token request
    const tokenRequest: TokenRequest = {
      grantType: 'authorization_code',
      code,
      redirectUri: finalRedirectUri,
      clientId: this.config.clientId
    };

    // Add client secret if provided (not used with PKCE)
    if (this.config.clientSecret && !this.config.usePKCE) {
      tokenRequest.clientSecret = this.config.clientSecret;
    }

    // Add PKCE code verifier if used
    if (stateData.codeVerifier) {
      tokenRequest.codeVerifier = stateData.codeVerifier;
    }

    try {
      const response = await this.performTokenRequest(tokenRequest);
      
      // Clean up used state
      this.pendingStates.delete(state);
      
      return response;
    } catch (error) {
      // Clean up state on error
      this.pendingStates.delete(state);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * @param refreshToken - Refresh token
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const tokenRequest: TokenRequest = {
      grantType: 'refresh_token',
      refreshToken,
      clientId: this.config.clientId
    };

    // Add client secret if provided
    if (this.config.clientSecret) {
      tokenRequest.clientSecret = this.config.clientSecret;
    }

    return await this.performTokenRequest(tokenRequest);
  }

  /**
   * Revoke a token (access or refresh token)
   * 
   * @param token - Token to revoke
   * @param tokenTypeHint - Hint about token type ('access_token' or 'refresh_token')
   * @returns Promise that resolves when token is revoked
   */
  async revokeToken(token: string, tokenTypeHint?: 'access_token' | 'refresh_token'): Promise<void> {
    // Some providers have a revocation endpoint
    // This is a placeholder for the actual implementation
    const revokeUrl = this.config.tokenUrl.replace('/token', '/revoke');
    
    const params = new URLSearchParams({
      token,
      client_id: this.config.clientId
    });

    if (tokenTypeHint) {
      params.set('token_type_hint', tokenTypeHint);
    }

    if (this.config.clientSecret) {
      params.set('client_secret', this.config.clientSecret);
    }

    try {
      await this.httpClient.post(revokeUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    } catch (error) {
      // Token revocation failure is not critical - token will expire naturally
      console.warn('Token revocation failed:', error);
    }
  }

  /**
   * Validate authorization callback parameters
   * 
   * @param params - Callback parameters from query string
   * @returns Validation result
   */
  validateAuthorizationCallback(params: Record<string, string>): {
    isValid: boolean;
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
  } {
    // Check for error response
    if (params.error) {
      return {
        isValid: false,
        error: params.error,
        errorDescription: params.error_description
      };
    }

    // Validate required parameters
    if (!params.code || !params.state) {
      return {
        isValid: false,
        error: 'missing_parameters',
        errorDescription: 'Missing required code or state parameter'
      };
    }

    // Validate state exists in pending states
    if (!this.pendingStates.has(params.state)) {
      return {
        isValid: false,
        error: 'invalid_state',
        errorDescription: 'Invalid or expired state parameter'
      };
    }

    return {
      isValid: true,
      code: params.code,
      state: params.state
    };
  }

  /**
   * Get OAuth 2.0 configuration information
   * 
   * @returns OAuth configuration (without sensitive data)
   */
  getConfig(): Omit<OAuth2Config, 'clientSecret'> {
    const { clientSecret, ...publicConfig } = this.config;
    return publicConfig;
  }

  /**
   * Get pending states count (for monitoring)
   * 
   * @returns Number of pending authorization states
   */
  getPendingStatesCount(): number {
    return this.pendingStates.size;
  }

  /**
   * Clear expired states manually
   * 
   * @returns Number of states cleaned up
   */
  clearExpiredStates(): number {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, stateData] of this.pendingStates.entries()) {
      const age = now - stateData.createdAt;
      if (age > 15 * 60 * 1000) { // 15 minutes
        expiredStates.push(state);
      }
    }

    for (const state of expiredStates) {
      this.pendingStates.delete(state);
    }

    return expiredStates.length;
  }

  /**
   * Perform token request to OAuth 2.0 server
   * 
   * @param request - Token request parameters
   * @returns Token response
   */
  private async performTokenRequest(request: TokenRequest): Promise<TokenResponse> {
    const params = new URLSearchParams();
    
    // Add grant type
    params.set('grant_type', request.grantType);
    
    // Add request-specific parameters
    if (request.code) {
      params.set('code', request.code);
    }
    
    if (request.redirectUri) {
      params.set('redirect_uri', request.redirectUri);
    }
    
    if (request.refreshToken) {
      params.set('refresh_token', request.refreshToken);
    }
    
    if (request.codeVerifier) {
      params.set('code_verifier', request.codeVerifier);
    }
    
    // Add client credentials
    params.set('client_id', request.clientId);
    
    if (request.clientSecret) {
      params.set('client_secret', request.clientSecret);
    }

    try {
      const response = await this.httpClient.post(this.config.tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createAuthError(
          this.mapErrorType(errorData.error),
          errorData.error_description || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      const tokenData = response.data;
      
      // Validate required fields
      if (!tokenData.access_token || !tokenData.token_type) {
        throw this.createAuthError(
          AuthErrorType.INVALID_GRANT,
          'Invalid token response: missing required fields'
        );
      }

      // Convert to standard format
      return {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in || 3600,
        refreshToken: tokenData.refresh_token,
        scope: tokenData.scope,
        idToken: tokenData.id_token
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AuthError') {
        throw error;
      }
      
      throw this.createAuthError(
        AuthErrorType.NETWORK_ERROR,
        `Token request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Map OAuth 2.0 error codes to internal error types
   * 
   * @param oauthError - OAuth 2.0 error code
   * @returns Internal error type
   */
  private mapErrorType(oauthError?: string): AuthErrorType {
    const errorMap: Record<string, AuthErrorType> = {
      'invalid_request': AuthErrorType.INVALID_REQUEST,
      'invalid_client': AuthErrorType.INVALID_CLIENT,
      'invalid_grant': AuthErrorType.INVALID_GRANT,
      'unauthorized_client': AuthErrorType.UNAUTHORIZED_CLIENT,
      'unsupported_grant_type': AuthErrorType.UNSUPPORTED_GRANT_TYPE,
      'invalid_scope': AuthErrorType.INVALID_SCOPE,
      'access_denied': AuthErrorType.ACCESS_DENIED
    };

    return errorMap[oauthError || ''] || AuthErrorType.INVALID_GRANT;
  }

  /**
   * Create structured authentication error
   * 
   * @param type - Error type
   * @param message - Error message
   * @param statusCode - HTTP status code
   * @param details - Additional error details
   * @returns Authentication error
   */
  private createAuthError(
    type: AuthErrorType, 
    message: string, 
    statusCode?: number, 
    details?: Record<string, any>
  ): AuthError {
    const error = new Error(message) as AuthError;
    error.name = 'AuthError';
    error.type = type;
    error.statusCode = statusCode;
    error.details = details;
    return error;
  }

  /**
   * Start timer to clean up expired states
   */
  private startStateCleanupTimer(): void {
    // Clean up expired states every 5 minutes
    setInterval(() => {
      this.clearExpiredStates();
    }, 5 * 60 * 1000);
  }
}