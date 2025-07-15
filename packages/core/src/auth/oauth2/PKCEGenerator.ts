/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes, createHash } from 'crypto';
import { PKCEParams } from '../types';

/**
 * PKCE (Proof Key for Code Exchange) generator
 * 
 * Implements RFC 7636 for OAuth 2.0 security enhancement.
 * PKCE protects against authorization code interception attacks
 * in public clients (mobile apps, SPAs).
 */
export class PKCEGenerator {
  private static readonly CODE_VERIFIER_LENGTH = 128;
  private static readonly CODE_VERIFIER_ALPHABET = 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

  /**
   * Generate PKCE parameters
   * 
   * @param method - Code challenge method ('S256' recommended, 'plain' for legacy)
   * @returns PKCE parameters including code verifier and challenge
   */
  static generatePKCE(method: 'S256' | 'plain' = 'S256'): PKCEParams {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier, method);

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: method
    };
  }

  /**
   * Generate a cryptographically secure code verifier
   * 
   * @returns Base64URL-encoded code verifier
   */
  private static generateCodeVerifier(): string {
    const buffer = randomBytes(96); // 96 bytes = 128 characters when base64url encoded
    return this.base64URLEncode(buffer);
  }

  /**
   * Generate code challenge from code verifier
   * 
   * @param codeVerifier - The code verifier
   * @param method - Challenge method
   * @returns Code challenge
   */
  private static generateCodeChallenge(
    codeVerifier: string, 
    method: 'S256' | 'plain'
  ): string {
    if (method === 'plain') {
      return codeVerifier;
    }

    // S256 method: BASE64URL(SHA256(code_verifier))
    const hash = createHash('sha256').update(codeVerifier).digest();
    return this.base64URLEncode(hash);
  }

  /**
   * Encode buffer as Base64URL (RFC 4648 Section 5)
   * 
   * @param buffer - Buffer to encode
   * @returns Base64URL encoded string
   */
  private static base64URLEncode(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Validate code verifier format
   * 
   * @param codeVerifier - Code verifier to validate
   * @returns True if valid
   */
  static validateCodeVerifier(codeVerifier: string): boolean {
    // RFC 7636: 43-128 characters, [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
      return false;
    }

    const validPattern = /^[A-Za-z0-9\-._~]+$/;
    return validPattern.test(codeVerifier);
  }

  /**
   * Verify code challenge against code verifier
   * 
   * @param codeVerifier - The original code verifier
   * @param codeChallenge - The code challenge to verify
   * @param method - The challenge method used
   * @returns True if challenge matches verifier
   */
  static verifyCodeChallenge(
    codeVerifier: string,
    codeChallenge: string,
    method: 'S256' | 'plain'
  ): boolean {
    if (!this.validateCodeVerifier(codeVerifier)) {
      return false;
    }

    const expectedChallenge = this.generateCodeChallenge(codeVerifier, method);
    return expectedChallenge === codeChallenge;
  }

  /**
   * Generate state parameter for CSRF protection
   * 
   * @returns Cryptographically secure state parameter
   */
  static generateState(): string {
    const buffer = randomBytes(32);
    return this.base64URLEncode(buffer);
  }

  /**
   * Generate nonce for OpenID Connect
   * 
   * @returns Cryptographically secure nonce
   */
  static generateNonce(): string {
    const buffer = randomBytes(32);
    return this.base64URLEncode(buffer);
  }
}