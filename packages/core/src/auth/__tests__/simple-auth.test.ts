/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect } from 'vitest';
import { PKCEGenerator } from '../oauth2/PKCEGenerator';
import { JWTValidator } from '../jwt/JWTValidator';
import { TokenStorage } from '../storage/TokenStorage';
import { AuthUtils, OAUTH2_PROVIDERS } from '../index';

describe('OAuth 2.0 Authentication System - Core Components', () => {
  describe('PKCE Generator', () => {
    test('should generate valid PKCE parameters', () => {
      const pkce = PKCEGenerator.generatePKCE();
      
      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeVerifier.length).toBe(128);
    });

    test('should validate code verifiers', () => {
      const pkce = PKCEGenerator.generatePKCE();
      expect(PKCEGenerator.validateCodeVerifier(pkce.codeVerifier)).toBe(true);
      expect(PKCEGenerator.validateCodeVerifier('invalid')).toBe(false);
    });
  });

  describe('JWT Validator', () => {
    test('should parse JWT tokens', () => {
      const validator = new JWTValidator();
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMDAwMzYwMH0.test-signature';
      
      const { header, payload } = validator.parseJWT(token);
      
      expect(header.alg).toBe('HS256');
      expect(payload.sub).toBe('test-user');
    });

    test('should handle invalid JWT format', () => {
      const validator = new JWTValidator();
      
      expect(() => {
        validator.parseJWT('invalid-jwt');
      }).toThrow('Invalid JWT format');
    });
  });

  describe('Token Storage', () => {
    test('should create token storage instance', () => {
      const storage = new TokenStorage();
      const stats = storage.getStorageStats();
      
      expect(stats.activeSessions).toBe(0);
      expect(stats.encryptionEnabled).toBe(true);
    });
  });

  describe('OAuth 2.0 Providers', () => {
    test('should have valid provider configurations', () => {
      expect(OAUTH2_PROVIDERS.google).toBeDefined();
      expect(OAUTH2_PROVIDERS.google.authorizationUrl).toContain('google.com');
      expect(OAUTH2_PROVIDERS.google.supportsPKCE).toBe(true);
    });
  });

  describe('Auth Utils', () => {
    test('should check token expiration', () => {
      const now = Math.floor(Date.now() / 1000);
      const futureExpiry = now + 3600; // 1 hour from now
      const pastExpiry = now - 3600; // 1 hour ago
      
      expect(AuthUtils.isTokenExpired(futureExpiry)).toBe(false);
      expect(AuthUtils.isTokenExpired(pastExpiry)).toBe(true);
    });

    test('should generate random strings', () => {
      const str1 = AuthUtils.generateRandomString(32);
      const str2 = AuthUtils.generateRandomString(32);
      
      expect(str1).toHaveLength(32);
      expect(str2).toHaveLength(32);
      expect(str1).not.toBe(str2);
    });

    test('should parse JWT tokens', () => {
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE2MzAwMDAwMDAsImV4cCI6MTYzMDAwMzYwMH0.test-signature';
      
      const { header, payload } = AuthUtils.parseJWT(token);
      
      expect(header.alg).toBe('HS256');
      expect(payload.sub).toBe('test-user');
    });

    test('should calculate time until expiration', () => {
      const now = Math.floor(Date.now() / 1000);
      const futureExpiry = now + 3600; // 1 hour from now
      
      const timeLeft = AuthUtils.getTimeUntilExpiration(futureExpiry);
      expect(timeLeft).toBeGreaterThan(3500); // Should be close to 3600
      expect(timeLeft).toBeLessThanOrEqual(3600);
    });
  });
});