/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createVerify, createPublicKey } from 'crypto';
import { JWTHeader, JWTPayload, TokenValidationResult } from '../types';

/**
 * JSON Web Key (JWK) format
 */
export interface JWK {
  kty: string; // Key type (RSA, EC, etc.)
  kid?: string; // Key ID
  use?: string; // Key use (sig, enc)
  alg?: string; // Algorithm
  n?: string; // RSA modulus
  e?: string; // RSA exponent
  x?: string; // EC x coordinate
  y?: string; // EC y coordinate
  crv?: string; // EC curve
  d?: string; // Private key component
}

/**
 * JSON Web Key Set (JWKS) format
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * JWT validation options
 */
export interface JWTValidationOptions {
  issuer?: string | string[]; // Expected issuer(s)
  audience?: string | string[]; // Expected audience(s)
  subject?: string; // Expected subject
  algorithms?: string[]; // Allowed algorithms
  clockTolerance?: number; // Clock skew tolerance in seconds
  maxAge?: number; // Maximum token age in seconds
  ignoreExpiration?: boolean; // Skip expiration check (for testing)
  ignoreNotBefore?: boolean; // Skip not-before check
}

/**
 * JWT validation and parsing utility
 * 
 * Provides secure JWT validation with support for:
 * - RSA and ECDSA signature verification
 * - JWKS (JSON Web Key Set) integration
 * - Comprehensive claim validation
 * - Security best practices enforcement
 */
export class JWTValidator {
  private jwksCache: Map<string, JWKS> = new Map();
  private jwksCacheExpiry: Map<string, number> = new Map();
  private readonly cacheTimeout = 3600000; // 1 hour

  /**
   * Parse JWT without verification (for inspection)
   * 
   * @param token - JWT token to parse
   * @returns Parsed header and payload
   */
  parseJWT(token: string): { header: JWTHeader; payload: JWTPayload } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format: token must have 3 parts');
    }

    try {
      const header = JSON.parse(this.base64URLDecode(parts[0]));
      const payload = JSON.parse(this.base64URLDecode(parts[1]));

      return { header, payload };
    } catch (error) {
      throw new Error('Invalid JWT: failed to parse header or payload');
    }
  }

  /**
   * Validate JWT token
   * 
   * @param token - JWT token to validate
   * @param publicKey - Public key for signature verification
   * @param options - Validation options
   * @returns Validation result
   */
  async validateJWT(
    token: string,
    publicKey: string | Buffer,
    options: JWTValidationOptions = {}
  ): Promise<TokenValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse JWT
      const { header, payload } = this.parseJWT(token);

      // Validate header
      this.validateHeader(header, options, errors);

      // Validate signature
      const isSignatureValid = this.verifySignature(token, publicKey, header.alg);
      if (!isSignatureValid) {
        errors.push('Invalid JWT signature');
      }

      // Validate payload claims
      this.validatePayload(payload, options, errors, warnings);

      return {
        isValid: errors.length === 0,
        payload: errors.length === 0 ? payload : undefined,
        errors,
        warnings,
        expiresAt: payload.exp
      };
    } catch (error) {
      errors.push(`JWT validation error: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        isValid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate JWT using JWKS endpoint
   * 
   * @param token - JWT token to validate
   * @param jwksUrl - JWKS endpoint URL
   * @param options - Validation options
   * @returns Validation result
   */
  async validateJWTWithJWKS(
    token: string,
    jwksUrl: string,
    options: JWTValidationOptions = {}
  ): Promise<TokenValidationResult> {
    try {
      const { header } = this.parseJWT(token);
      
      if (!header.kid) {
        return {
          isValid: false,
          errors: ['JWT header missing kid (key ID) claim'],
          warnings: []
        };
      }

      const jwks = await this.fetchJWKS(jwksUrl);
      const jwk = jwks.keys.find(key => key.kid === header.kid);

      if (!jwk) {
        return {
          isValid: false,
          errors: [`No JWK found for kid: ${header.kid}`],
          warnings: []
        };
      }

      const publicKey = this.jwkToPublicKey(jwk);
      return await this.validateJWT(token, publicKey, options);
    } catch (error) {
      return {
        isValid: false,
        errors: [`JWKS validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: []
      };
    }
  }

  /**
   * Fetch JWKS from endpoint with caching
   * 
   * @param jwksUrl - JWKS endpoint URL
   * @returns JWKS data
   */
  private async fetchJWKS(jwksUrl: string): Promise<JWKS> {
    const now = Date.now();
    const cached = this.jwksCache.get(jwksUrl);
    const expiry = this.jwksCacheExpiry.get(jwksUrl);

    if (cached && expiry && now < expiry) {
      return cached;
    }

    try {
      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
      }

      const jwks: JWKS = await response.json();
      
      // Cache the result
      this.jwksCache.set(jwksUrl, jwks);
      this.jwksCacheExpiry.set(jwksUrl, now + this.cacheTimeout);

      return jwks;
    } catch (error) {
      throw new Error(`JWKS fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert JWK to public key
   * 
   * @param jwk - JSON Web Key
   * @returns Public key in PEM format
   */
  private jwkToPublicKey(jwk: JWK): string {
    if (jwk.kty === 'RSA') {
      if (!jwk.n || !jwk.e) {
        throw new Error('Invalid RSA JWK: missing n or e parameter');
      }

      // Convert base64url to buffer
      const n = Buffer.from(jwk.n, 'base64url');
      const e = Buffer.from(jwk.e, 'base64url');

      // Create RSA public key
      const publicKey = createPublicKey({
        key: {
          n,
          e,
          kty: 'RSA'
        },
        format: 'jwk'
      });

      return publicKey.export({ type: 'spki', format: 'pem' }) as string;
    } else if (jwk.kty === 'EC') {
      if (!jwk.x || !jwk.y || !jwk.crv) {
        throw new Error('Invalid EC JWK: missing x, y, or crv parameter');
      }

      const publicKey = createPublicKey({
        key: {
          x: jwk.x,
          y: jwk.y,
          crv: jwk.crv,
          kty: 'EC'
        },
        format: 'jwk'
      });

      return publicKey.export({ type: 'spki', format: 'pem' }) as string;
    }

    throw new Error(`Unsupported JWK key type: ${jwk.kty}`);
  }

  /**
   * Verify JWT signature
   * 
   * @param token - JWT token
   * @param publicKey - Public key for verification
   * @param algorithm - Signature algorithm
   * @returns True if signature is valid
   */
  private verifySignature(token: string, publicKey: string | Buffer, algorithm: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const header = parts[0];
    const payload = parts[1];
    const signature = parts[2];

    const signedData = `${header}.${payload}`;
    const signatureBuffer = Buffer.from(signature, 'base64url');

    try {
      // Map JWT algorithms to Node.js algorithms
      const nodeAlgorithm = this.mapAlgorithm(algorithm);
      const verifier = createVerify(nodeAlgorithm);
      verifier.update(signedData);
      
      return verifier.verify(publicKey, signatureBuffer);
    } catch (error) {
      return false;
    }
  }

  /**
   * Map JWT algorithm to Node.js algorithm
   * 
   * @param jwtAlgorithm - JWT algorithm identifier
   * @returns Node.js algorithm name
   */
  private mapAlgorithm(jwtAlgorithm: string): string {
    const algorithmMap: Record<string, string> = {
      'RS256': 'RSA-SHA256',
      'RS384': 'RSA-SHA384',
      'RS512': 'RSA-SHA512',
      'ES256': 'sha256',
      'ES384': 'sha384',
      'ES512': 'sha512',
      'PS256': 'RSA-PSS',
      'PS384': 'RSA-PSS',
      'PS512': 'RSA-PSS'
    };

    const algorithm = algorithmMap[jwtAlgorithm];
    if (!algorithm) {
      throw new Error(`Unsupported JWT algorithm: ${jwtAlgorithm}`);
    }

    return algorithm;
  }

  /**
   * Validate JWT header
   * 
   * @param header - JWT header
   * @param options - Validation options
   * @param errors - Error array to populate
   */
  private validateHeader(
    header: JWTHeader,
    options: JWTValidationOptions,
    errors: string[]
  ): void {
    // Validate token type
    if (header.typ && header.typ !== 'JWT') {
      errors.push(`Invalid token type: expected JWT, got ${header.typ}`);
    }

    // Validate algorithm
    if (options.algorithms && !options.algorithms.includes(header.alg)) {
      errors.push(`Algorithm not allowed: ${header.alg}`);
    }

    // Check for algorithm 'none' (security issue)
    if (header.alg === 'none') {
      errors.push('Algorithm "none" is not allowed');
    }
  }

  /**
   * Validate JWT payload claims
   * 
   * @param payload - JWT payload
   * @param options - Validation options
   * @param errors - Error array to populate
   * @param warnings - Warning array to populate
   */
  private validatePayload(
    payload: JWTPayload,
    options: JWTValidationOptions,
    errors: string[],
    warnings: string[]
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = options.clockTolerance || 60; // 60 seconds default

    // Validate expiration (exp)
    if (!options.ignoreExpiration && payload.exp) {
      if (now > payload.exp + clockTolerance) {
        errors.push('JWT has expired');
      } else if (now > payload.exp) {
        warnings.push('JWT expiration is within clock tolerance');
      }
    }

    // Validate not before (nbf)
    if (!options.ignoreNotBefore && payload.nbf) {
      if (now < payload.nbf - clockTolerance) {
        errors.push('JWT not valid yet (nbf claim)');
      }
    }

    // Validate issued at (iat)
    if (payload.iat) {
      if (payload.iat > now + clockTolerance) {
        errors.push('JWT issued in the future');
      }

      // Check max age
      if (options.maxAge && (now - payload.iat) > options.maxAge) {
        errors.push('JWT is too old');
      }
    }

    // Validate issuer (iss)
    if (options.issuer && payload.iss) {
      const expectedIssuers = Array.isArray(options.issuer) ? options.issuer : [options.issuer];
      if (!expectedIssuers.includes(payload.iss)) {
        errors.push(`Invalid issuer: expected ${expectedIssuers.join(', ')}, got ${payload.iss}`);
      }
    }

    // Validate audience (aud)
    if (options.audience && payload.aud) {
      const expectedAudiences = Array.isArray(options.audience) ? options.audience : [options.audience];
      const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      
      const hasValidAudience = expectedAudiences.some(expected =>
        tokenAudiences.includes(expected)
      );

      if (!hasValidAudience) {
        errors.push(`Invalid audience: expected ${expectedAudiences.join(', ')}, got ${tokenAudiences.join(', ')}`);
      }
    }

    // Validate subject (sub)
    if (options.subject && payload.sub && payload.sub !== options.subject) {
      errors.push(`Invalid subject: expected ${options.subject}, got ${payload.sub}`);
    }
  }

  /**
   * Base64URL decode
   * 
   * @param str - Base64URL encoded string
   * @returns Decoded string
   */
  private base64URLDecode(str: string): string {
    // Add padding if needed
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    // Convert base64url to base64
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Clear JWKS cache
   */
  clearCache(): void {
    this.jwksCache.clear();
    this.jwksCacheExpiry.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.jwksCache.size,
      entries: Array.from(this.jwksCache.keys())
    };
  }
}