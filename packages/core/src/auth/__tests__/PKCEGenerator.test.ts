/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test, expect } from 'vitest';
import { PKCEGenerator } from '../oauth2/PKCEGenerator';

describe('PKCEGenerator', () => {
  describe('PKCE Generation', () => {
    test('should generate PKCE parameters with S256 method', () => {
      const pkce = PKCEGenerator.generatePKCE('S256');

      expect(pkce).toHaveProperty('codeVerifier');
      expect(pkce).toHaveProperty('codeChallenge');
      expect(pkce).toHaveProperty('codeChallengeMethod');
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeVerifier).toHaveLength(128);
      expect(pkce.codeChallenge).not.toBe(pkce.codeVerifier);
    });

    test('should generate PKCE parameters with plain method', () => {
      const pkce = PKCEGenerator.generatePKCE('plain');

      expect(pkce.codeChallengeMethod).toBe('plain');
      expect(pkce.codeChallenge).toBe(pkce.codeVerifier);
    });

    test('should default to S256 method', () => {
      const pkce = PKCEGenerator.generatePKCE();
      expect(pkce.codeChallengeMethod).toBe('S256');
    });

    test('should generate unique PKCE parameters each time', () => {
      const pkce1 = PKCEGenerator.generatePKCE();
      const pkce2 = PKCEGenerator.generatePKCE();

      expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
      expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge);
    });
  });

  describe('Code Verifier Validation', () => {
    test('should validate correct code verifier', () => {
      const pkce = PKCEGenerator.generatePKCE();
      expect(PKCEGenerator.validateCodeVerifier(pkce.codeVerifier)).toBe(true);
    });

    test('should reject code verifier that is too short', () => {
      const shortVerifier = 'too-short';
      expect(PKCEGenerator.validateCodeVerifier(shortVerifier)).toBe(false);
    });

    test('should reject code verifier that is too long', () => {
      const longVerifier = 'a'.repeat(129);
      expect(PKCEGenerator.validateCodeVerifier(longVerifier)).toBe(false);
    });

    test('should reject code verifier with invalid characters', () => {
      const invalidVerifier = 'invalid#characters!';
      expect(PKCEGenerator.validateCodeVerifier(invalidVerifier)).toBe(false);
    });

    test('should accept code verifier with valid characters', () => {
      const validVerifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop-._~';
      expect(PKCEGenerator.validateCodeVerifier(validVerifier)).toBe(true);
    });
  });

  describe('Code Challenge Verification', () => {
    test('should verify S256 code challenge', () => {
      const pkce = PKCEGenerator.generatePKCE('S256');
      
      const isValid = PKCEGenerator.verifyCodeChallenge(
        pkce.codeVerifier,
        pkce.codeChallenge,
        'S256'
      );

      expect(isValid).toBe(true);
    });

    test('should verify plain code challenge', () => {
      const pkce = PKCEGenerator.generatePKCE('plain');
      
      const isValid = PKCEGenerator.verifyCodeChallenge(
        pkce.codeVerifier,
        pkce.codeChallenge,
        'plain'
      );

      expect(isValid).toBe(true);
    });

    test('should reject invalid code challenge', () => {
      const pkce = PKCEGenerator.generatePKCE('S256');
      
      const isValid = PKCEGenerator.verifyCodeChallenge(
        pkce.codeVerifier,
        'invalid-challenge',
        'S256'
      );

      expect(isValid).toBe(false);
    });

    test('should reject invalid code verifier', () => {
      const pkce = PKCEGenerator.generatePKCE('S256');
      
      const isValid = PKCEGenerator.verifyCodeChallenge(
        'invalid',
        pkce.codeChallenge,
        'S256'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('State and Nonce Generation', () => {
    test('should generate secure state parameter', () => {
      const state1 = PKCEGenerator.generateState();
      const state2 = PKCEGenerator.generateState();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
      expect(state1.length).toBeGreaterThan(40); // Base64URL encoded 32 bytes
    });

    test('should generate secure nonce', () => {
      const nonce1 = PKCEGenerator.generateNonce();
      const nonce2 = PKCEGenerator.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1.length).toBeGreaterThan(40); // Base64URL encoded 32 bytes
    });

    test('should generate base64url safe characters', () => {
      const state = PKCEGenerator.generateState();
      const nonce = PKCEGenerator.generateNonce();

      // Should not contain +, /, or = characters (base64url)
      expect(state).not.toMatch(/[+/=]/);
      expect(nonce).not.toMatch(/[+/=]/);

      // Should only contain valid base64url characters
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('RFC 7636 Compliance', () => {
    test('should generate code verifier within RFC length requirements', () => {
      const pkce = PKCEGenerator.generatePKCE();
      
      // RFC 7636: code verifier must be 43-128 characters
      expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(pkce.codeVerifier.length).toBeLessThanOrEqual(128);
    });

    test('should use only allowed characters in code verifier', () => {
      const pkce = PKCEGenerator.generatePKCE();
      
      // RFC 7636: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      const allowedPattern = /^[A-Za-z0-9\-._~]+$/;
      expect(pkce.codeVerifier).toMatch(allowedPattern);
    });

    test('should generate different code verifiers with sufficient entropy', () => {
      const codeVerifiers = new Set();
      
      // Generate multiple code verifiers to test uniqueness
      for (let i = 0; i < 100; i++) {
        const pkce = PKCEGenerator.generatePKCE();
        codeVerifiers.add(pkce.codeVerifier);
      }
      
      // All should be unique
      expect(codeVerifiers.size).toBe(100);
    });
  });
});