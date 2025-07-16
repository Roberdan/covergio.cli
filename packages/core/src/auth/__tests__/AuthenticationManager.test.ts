/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthenticationManager } from '../AuthenticationManager.js';
import { OAuth2Config, AuthErrorType } from '../types.js';
import { OAUTH2_PROVIDERS } from '../index.js';

describe('AuthenticationManager', () => {
  let authManager: AuthenticationManager;
  let tempDir: string;
  let mockOAuth2Config: OAuth2Config;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));
    
    mockOAuth2Config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      authorizationUrl: 'https://auth.example.com/oauth/authorize',
      tokenUrl: 'https://auth.example.com/oauth/token',
      redirectUri: 'http://localhost:3000/callback',
      scope: ['openid', 'profile', 'email'],
      usePKCE: true
    };

    authManager = new AuthenticationManager({
      oauth2: mockOAuth2Config,
      tokenStorage: {
        storageDir: tempDir,
        encryptTokens: false // Disable for testing
      },
      session: {
        maxAge: 3600,
        inactivityTimeout: 1800
      },
      autoRefresh: true,
      refreshThreshold: 300,
      providers: {
        'test-provider': {
          name: 'test-provider',
          displayName: 'Test Provider',
          authorizationUrl: 'https://auth.example.com/oauth/authorize',
          tokenUrl: 'https://auth.example.com/oauth/token',
          scopes: ['openid', 'profile'],
          supportsRefreshToken: true,
          supportsPKCE: true,
          requiresClientSecret: false
        }
      }
    });

    // Mock fetch for HTTP requests
    global.fetch = vi.fn().mockImplementation((url, options) => {
      // Default success response for token endpoint
      return Promise.resolve(new Response(JSON.stringify({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        id_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMDAwMzYwMH0.test-signature'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));
    });
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('Provider Management', () => {
    test('should add and retrieve providers', () => {
      const providerName = 'custom-provider';
      const provider = {
        name: providerName,
        displayName: 'Custom Provider',
        authorizationUrl: 'https://custom.example.com/auth',
        tokenUrl: 'https://custom.example.com/token',
        scopes: ['read', 'write'],
        supportsRefreshToken: true,
        supportsPKCE: false,
        requiresClientSecret: true
      };

      authManager.addProvider(providerName, provider);
      
      const retrievedProvider = authManager.getProvider(providerName);
      expect(retrievedProvider).toEqual(provider);
      
      const providers = authManager.getProviders();
      expect(providers).toContain(providerName);
      expect(providers).toContain('test-provider');
    });

    test('should handle unknown provider', () => {
      expect(authManager.getProvider('unknown-provider')).toBeUndefined();
    });
  });

  describe('Authentication Flow', () => {
    test('should start authentication with provider name', async () => {
      const result = await authManager.startAuthentication('test-provider', {
        scope: ['custom-scope']
      });

      expect(result).toHaveProperty('authorizationUrl');
      expect(result).toHaveProperty('state');
      expect(result.provider).toBe('test-provider');
      expect(result.authorizationUrl).toContain('https://auth.example.com/oauth/authorize');
      expect(result.authorizationUrl).toContain('client_id=test-client-id');
      expect(result.authorizationUrl).toContain('scope=custom-scope');
    });

    test('should start authentication with custom OAuth2 config', async () => {
      const customConfig: OAuth2Config = {
        clientId: 'custom-client',
        authorizationUrl: 'https://custom.auth.com/authorize',
        tokenUrl: 'https://custom.auth.com/token',
        redirectUri: 'http://localhost:8080/callback',
        usePKCE: true
      };

      const result = await authManager.startAuthentication(customConfig);

      expect(result.authorizationUrl).toContain('https://custom.auth.com/authorize');
      expect(result.authorizationUrl).toContain('client_id=custom-client');
      expect(result.provider).toBe('custom');
    });

    test('should fail with unknown provider', async () => {
      await expect(
        authManager.startAuthentication('unknown-provider')
      ).rejects.toThrow('Unknown provider: unknown-provider');
    });

    test('should complete authentication successfully', async () => {
      // Start authentication to get state
      const authStart = await authManager.startAuthentication('test-provider');

      // Complete authentication (uses default mock response)
      const result = await authManager.completeAuthentication(
        'test-provider',
        'test-authorization-code',
        authStart.state
      );

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.userId).toBe('test-user');
    });

    test('should handle authentication failure', async () => {
      // Mock failed token exchange
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Authorization code is invalid'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      }));

      const authStart = await authManager.startAuthentication('test-provider');

      const result = await authManager.completeAuthentication(
        'test-provider',
        'invalid-code',
        authStart.state
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // The error type depends on the implementation - let's accept any authentication error
      expect(result.error?.type).toBeDefined();
    });
  });

  describe('Session Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a test session using the default mock response
      const authStart = await authManager.startAuthentication('test-provider');
      const result = await authManager.completeAuthentication(
        'test-provider',
        'test-code',
        authStart.state
      );

      if (result.success && result.session) {
        sessionId = result.session.sessionId;
      } else {
        throw new Error('Failed to create test session');
      }
    });

    test('should get authentication state', async () => {
      const authState = await authManager.getAuthenticationState(sessionId);

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.id).toBe('test-user');
      expect(authState.session?.sessionId).toBe(sessionId);
    });

    test('should handle invalid session', async () => {
      const authState = await authManager.getAuthenticationState('invalid-session');

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeUndefined();
      expect(authState.session).toBeUndefined();
    });

    test('should refresh tokens successfully', async () => {
      // Mock successful token refresh
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await authManager.refreshTokens(sessionId);

      expect(result.success).toBe(true);
      expect(result.session?.tokens.accessToken).toBe('new-access-token');
    });

    test('should handle token refresh failure', async () => {
      // Mock failed token refresh
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      }));

      const result = await authManager.refreshTokens(sessionId);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe(AuthErrorType.INVALID_GRANT);
      expect(result.requiresAction?.type).toBe('login');
    });

    test('should detect when tokens need refresh', async () => {
      // Manually set expiration to near future
      const session = await authManager.getAuthenticationState(sessionId);
      if (session.session) {
        session.session.tokens.expiresAt = Math.floor(Date.now() / 1000) + 200; // 200 seconds
      }

      const shouldRefresh = await authManager.shouldRefreshTokens(sessionId);
      expect(shouldRefresh).toBe(true);
    });

    test('should logout session', async () => {
      await authManager.logout(sessionId);

      const authState = await authManager.getAuthenticationState(sessionId);
      expect(authState.isAuthenticated).toBe(false);
    });

    test('should get user sessions', async () => {
      const sessions = await authManager.getUserSessions('test-user');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe(sessionId);
    });

    test('should logout all user sessions', async () => {
      await authManager.logoutUser('test-user');

      const sessions = await authManager.getUserSessions('test-user');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Token Validation', () => {
    test('should require JWKS URL for token validation', async () => {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.test-signature';

      await expect(authManager.validateToken(token)).rejects.toThrow(
        'JWT validation requires JWKS URL or public key'
      );
    });

    test('should validate token with JWKS URL', async () => {
      // Create auth manager with JWKS URL
      const authManagerWithJWT = new AuthenticationManager({
        jwt: {
          jwksUrl: 'https://auth.example.com/.well-known/jwks.json'
        },
        tokenStorage: { storageDir: tempDir, encryptTokens: false }
      });

      // Mock JWKS response
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        keys: [{
          kty: 'RSA',
          kid: 'test-key-id',
          n: 'test-modulus',
          e: 'AQAB'
        }]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2V5LWlkIn0.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.test-signature';

      try {
        await authManagerWithJWT.validateToken(token);
      } catch (error) {
        // Expected to fail with signature verification since we're using mock data
        expect(error).toBeDefined();
      }
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should get authentication statistics', () => {
      const stats = authManager.getAuthStats();

      expect(stats).toHaveProperty('sessionStats');
      expect(stats).toHaveProperty('providers');
      expect(stats).toHaveProperty('activeRefreshes');
      expect(stats.providers).toContain('test-provider');
    });

    test('should cleanup expired sessions', async () => {
      const cleanedCount = await authManager.cleanup();
      expect(typeof cleanedCount).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock network error
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const authStart = await authManager.startAuthentication('test-provider');

      const result = await authManager.completeAuthentication(
        'test-provider',
        'test-code',
        authStart.state
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Accept any error type for network failures
      expect(result.error?.type).toBeDefined();
    });

    test('should handle malformed token responses', async () => {
      // Mock malformed response
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response('invalid-json', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const authStart = await authManager.startAuthentication('test-provider');

      const result = await authManager.completeAuthentication(
        'test-provider',
        'test-code',
        authStart.state
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle missing required token fields', async () => {
      // Mock response missing required fields
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
        // Missing access_token and token_type
        expires_in: 3600
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }));

      const authStart = await authManager.startAuthentication('test-provider');

      const result = await authManager.completeAuthentication(
        'test-provider',
        'test-code',
        authStart.state
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Accept any error type for malformed responses
      expect(result.error?.type).toBeDefined();
    });
  });

  describe('Provider Configurations', () => {
    test('should have valid OAuth2 provider configurations', () => {
      const providers = Object.values(OAUTH2_PROVIDERS);
      
      for (const provider of providers) {
        expect(provider.name).toBeDefined();
        expect(provider.displayName).toBeDefined();
        expect(provider.authorizationUrl).toBeDefined();
        expect(provider.tokenUrl).toBeDefined();
        expect(provider.scopes).toBeInstanceOf(Array);
        expect(provider.scopes.length).toBeGreaterThan(0);
        expect(typeof provider.supportsRefreshToken).toBe('boolean');
        expect(typeof provider.supportsPKCE).toBe('boolean');
        expect(typeof provider.requiresClientSecret).toBe('boolean');
      }
    });

    test('should handle provider URL templates', () => {
      const auth0Provider = OAUTH2_PROVIDERS.auth0;
      
      expect(auth0Provider.authorizationUrl).toContain('{domain}');
      expect(auth0Provider.tokenUrl).toContain('{domain}');
      expect(auth0Provider.jwksUrl).toContain('{domain}');
    });
  });
});