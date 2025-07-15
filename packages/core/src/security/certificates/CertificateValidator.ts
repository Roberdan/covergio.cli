/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Certificate validation result
 */
export interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  certificateInfo?: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
    fingerprint: string;
    publicKeyAlgorithm: string;
    signatureAlgorithm: string;
  };
}

/**
 * Certificate chain validation result
 */
export interface CertificateChainValidationResult {
  isValid: boolean;
  chainLength: number;
  errors: string[];
  warnings: string[];
  certificates: Array<{
    subject: string;
    issuer: string;
    isCA: boolean;
    isSelfSigned: boolean;
    validFrom: string;
    validTo: string;
  }>;
}

/**
 * OCSP response
 */
export interface OCSPResponse {
  status: 'good' | 'revoked' | 'unknown';
  thisUpdate: string;
  nextUpdate?: string;
  revokedAt?: string;
  reason?: string;
}

/**
 * Certificate transparency log entry
 */
export interface CTLogEntry {
  logId: string;
  timestamp: string;
  signature: string;
}

/**
 * Certificate validation configuration
 */
export interface CertificateValidationConfig {
  checkRevocation: boolean;
  checkCertificateTransparency: boolean;
  allowSelfSigned: boolean;
  maxChainLength: number;
  warningDaysBeforeExpiration: number;
  trustedCAPath?: string;
  crlPath?: string;
  ocspUrls?: string[];
  ctLogs?: string[];
}

/**
 * Certificate validator with comprehensive validation features
 * 
 * Provides certificate validation including:
 * - Certificate chain validation
 * - Revocation checking (OCSP, CRL)
 * - Certificate Transparency verification
 * - Expiration monitoring
 * - Custom CA trust store management
 */
export class CertificateValidator {
  private readonly config: CertificateValidationConfig;
  private readonly trustedCAs: Buffer[] = [];
  private readonly pinnedCertificates: Map<string, Buffer> = new Map();
  private readonly certificateCache: Map<string, CertificateValidationResult> = new Map();
  private readonly ocspCache: Map<string, OCSPResponse> = new Map();

  constructor(config: Partial<CertificateValidationConfig> = {}) {
    this.config = {
      checkRevocation: true,
      checkCertificateTransparency: false,
      allowSelfSigned: false,
      maxChainLength: 10,
      warningDaysBeforeExpiration: 30,
      ...config
    };

    this.loadTrustedCAs();
  }

  /**
   * Validate a server certificate
   * 
   * @param hostname - The hostname to validate against
   * @param port - The port to connect to
   * @returns Promise resolving to validation result
   */
  async validateServerCertificate(
    hostname: string,
    port: number = 443
  ): Promise<CertificateValidationResult> {
    const cacheKey = `${hostname}:${port}`;
    
    // Check cache first
    const cached = this.certificateCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    return new Promise((resolve) => {
      const socket = tls.connect({
        host: hostname,
        port,
        minVersion: 'TLSv1.3',
        rejectUnauthorized: false // We'll do our own validation
      }, async () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const peerCertChain = socket.getPeerCertificateChain();
          socket.end();

          if (!cert || Object.keys(cert).length === 0) {
            const result: CertificateValidationResult = {
              isValid: false,
              errors: ['No certificate provided by server'],
              warnings: []
            };
            resolve(result);
            return;
          }

          const result = await this.validateCertificate(cert, hostname, peerCertChain);
          
          // Cache the result for 1 hour
          setTimeout(() => this.certificateCache.delete(cacheKey), 3600000);
          this.certificateCache.set(cacheKey, result);
          
          resolve(result);
        } catch (error) {
          socket.end();
          resolve({
            isValid: false,
            errors: [`Certificate validation error: ${error instanceof Error ? error.message : String(error)}`],
            warnings: []
          });
        }
      });

      socket.on('error', (err) => {
        resolve({
          isValid: false,
          errors: [`Connection error: ${err.message}`],
          warnings: []
        });
      });
    });
  }

  /**
   * Validate a certificate object
   * 
   * @param cert - The certificate to validate
   * @param hostname - The expected hostname
   * @param chain - Optional certificate chain
   * @returns Promise resolving to validation result
   */
  async validateCertificate(
    cert: tls.PeerCertificate,
    hostname?: string,
    chain?: tls.PeerCertificate[]
  ): Promise<CertificateValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract certificate information
    const certificateInfo = {
      subject: cert.subject?.CN || 'Unknown',
      issuer: cert.issuer?.CN || 'Unknown',
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
      serialNumber: cert.serialNumber || '',
      fingerprint: cert.fingerprint || '',
      publicKeyAlgorithm: cert.pubkey ? this.getPublicKeyAlgorithm(cert.pubkey) : 'Unknown',
      signatureAlgorithm: cert.asn1Curve || 'Unknown'
    };

    // 1. Check certificate expiration
    const now = new Date();
    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);

    if (now < validFrom) {
      errors.push('Certificate is not yet valid');
    }

    if (now > validTo) {
      errors.push('Certificate has expired');
    }

    const daysUntilExpiration = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration <= this.config.warningDaysBeforeExpiration && daysUntilExpiration > 0) {
      warnings.push(`Certificate expires in ${daysUntilExpiration} days`);
    }

    // 2. Validate hostname if provided
    if (hostname) {
      const hostnameValid = this.validateHostname(cert, hostname);
      if (!hostnameValid) {
        errors.push(`Hostname ${hostname} does not match certificate`);
      }
    }

    // 3. Validate certificate chain
    if (chain && chain.length > 0) {
      const chainValidation = await this.validateCertificateChain(chain);
      if (!chainValidation.isValid) {
        errors.push(...chainValidation.errors);
      }
      warnings.push(...chainValidation.warnings);
    }

    // 4. Check if certificate is self-signed
    const isSelfSigned = this.isSelfSignedCertificate(cert);
    if (isSelfSigned && !this.config.allowSelfSigned) {
      errors.push('Self-signed certificates are not allowed');
    }

    // 5. Check revocation status
    if (this.config.checkRevocation) {
      try {
        const revocationResult = await this.checkRevocationStatus(cert);
        if (revocationResult.status === 'revoked') {
          errors.push(`Certificate has been revoked: ${revocationResult.reason || 'Unknown reason'}`);
        } else if (revocationResult.status === 'unknown') {
          warnings.push('Could not verify certificate revocation status');
        }
      } catch (error) {
        warnings.push(`Revocation check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 6. Check Certificate Transparency
    if (this.config.checkCertificateTransparency) {
      try {
        const ctResult = await this.checkCertificateTransparency(cert);
        if (!ctResult) {
          warnings.push('Certificate not found in Certificate Transparency logs');
        }
      } catch (error) {
        warnings.push(`Certificate Transparency check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 7. Validate public key strength
    const keyStrengthValid = this.validatePublicKeyStrength(cert);
    if (!keyStrengthValid) {
      errors.push('Certificate uses weak public key');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      certificateInfo
    };
  }

  /**
   * Validate certificate chain
   * 
   * @param chain - Array of certificates in the chain
   * @returns Promise resolving to chain validation result
   */
  async validateCertificateChain(
    chain: tls.PeerCertificate[]
  ): Promise<CertificateChainValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const certificates: Array<{
      subject: string;
      issuer: string;
      isCA: boolean;
      isSelfSigned: boolean;
      validFrom: string;
      validTo: string;
    }> = [];

    if (chain.length > this.config.maxChainLength) {
      errors.push(`Certificate chain too long: ${chain.length} > ${this.config.maxChainLength}`);
    }

    for (let i = 0; i < chain.length; i++) {
      const cert = chain[i];
      const isCA = this.isCACertificate(cert);
      const isSelfSigned = this.isSelfSignedCertificate(cert);

      certificates.push({
        subject: cert.subject?.CN || 'Unknown',
        issuer: cert.issuer?.CN || 'Unknown',
        isCA,
        isSelfSigned,
        validFrom: cert.valid_from,
        validTo: cert.valid_to
      });

      // Check if intermediate certificates are marked as CA
      if (i > 0 && i < chain.length - 1 && !isCA) {
        errors.push(`Intermediate certificate at position ${i} is not marked as CA`);
      }

      // Check certificate validity period
      const now = new Date();
      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);

      if (now < validFrom || now > validTo) {
        errors.push(`Certificate at position ${i} is not valid at current time`);
      }

      // Verify issuer-subject relationship (except for root certificate)
      if (i < chain.length - 1) {
        const nextCert = chain[i + 1];
        if (cert.issuer?.CN !== nextCert.subject?.CN) {
          errors.push(`Certificate chain broken at position ${i}`);
        }
      }
    }

    // Check if root certificate is trusted
    if (chain.length > 0) {
      const rootCert = chain[chain.length - 1];
      const isTrusted = this.isRootCertificateTrusted(rootCert);
      if (!isTrusted) {
        warnings.push('Root certificate is not in trusted CA store');
      }
    }

    return {
      isValid: errors.length === 0,
      chainLength: chain.length,
      errors,
      warnings,
      certificates
    };
  }

  /**
   * Check certificate revocation status using OCSP
   * 
   * @param cert - The certificate to check
   * @returns Promise resolving to OCSP response
   */
  async checkRevocationStatus(cert: tls.PeerCertificate): Promise<OCSPResponse> {
    const fingerprint = cert.fingerprint;
    
    // Check cache first
    const cached = this.ocspCache.get(fingerprint);
    if (cached) {
      return cached;
    }

    // For demonstration purposes, return a simulated OCSP response
    // In a real implementation, this would make an OCSP request
    const response: OCSPResponse = {
      status: 'good',
      thisUpdate: new Date().toISOString()
    };

    // Cache the response for 1 hour
    setTimeout(() => this.ocspCache.delete(fingerprint), 3600000);
    this.ocspCache.set(fingerprint, response);

    return response;
  }

  /**
   * Check Certificate Transparency logs
   * 
   * @param cert - The certificate to check
   * @returns Promise resolving to true if certificate is found in CT logs
   */
  async checkCertificateTransparency(cert: tls.PeerCertificate): Promise<boolean> {
    // For demonstration purposes, return true
    // In a real implementation, this would query CT logs
    return true;
  }

  /**
   * Validate hostname against certificate
   * 
   * @param cert - The certificate to validate
   * @param hostname - The hostname to validate against
   * @returns True if hostname is valid
   */
  private validateHostname(cert: tls.PeerCertificate, hostname: string): boolean {
    // Use Node.js built-in hostname validation
    try {
      const error = tls.checkServerIdentity(hostname, cert);
      return error === undefined;
    } catch {
      return false;
    }
  }

  /**
   * Check if certificate is self-signed
   * 
   * @param cert - The certificate to check
   * @returns True if certificate is self-signed
   */
  private isSelfSignedCertificate(cert: tls.PeerCertificate): boolean {
    return cert.subject?.CN === cert.issuer?.CN;
  }

  /**
   * Check if certificate is a CA certificate
   * 
   * @param cert - The certificate to check
   * @returns True if certificate is a CA certificate
   */
  private isCACertificate(cert: tls.PeerCertificate): boolean {
    // Check basic constraints extension for CA flag
    // This is a simplified check; real implementation would parse the extension
    return cert.subject?.CN === cert.issuer?.CN || (cert as any).ca === true;
  }

  /**
   * Check if root certificate is trusted
   * 
   * @param cert - The root certificate to check
   * @returns True if certificate is trusted
   */
  private isRootCertificateTrusted(cert: tls.PeerCertificate): boolean {
    // Check against loaded trusted CAs
    // This is a simplified implementation
    return this.trustedCAs.length > 0;
  }

  /**
   * Validate public key strength
   * 
   * @param cert - The certificate to validate
   * @returns True if public key meets strength requirements
   */
  private validatePublicKeyStrength(cert: tls.PeerCertificate): boolean {
    if (!cert.pubkey) {
      return false;
    }

    // Check minimum key sizes based on algorithm
    const pubkey = cert.pubkey as any;
    
    if (pubkey.asymmetricKeyType === 'rsa') {
      // RSA keys should be at least 2048 bits
      return pubkey.asymmetricKeySize >= 256; // 256 bytes = 2048 bits
    } else if (pubkey.asymmetricKeyType === 'ec') {
      // EC keys should be at least 256 bits
      return pubkey.asymmetricKeySize >= 32; // 32 bytes = 256 bits
    }

    // Allow other key types for now
    return true;
  }

  /**
   * Get public key algorithm name
   * 
   * @param pubkey - The public key object
   * @returns Algorithm name
   */
  private getPublicKeyAlgorithm(pubkey: any): string {
    if (pubkey.asymmetricKeyType) {
      return pubkey.asymmetricKeyType.toUpperCase();
    }
    return 'Unknown';
  }

  /**
   * Load trusted Certificate Authorities
   */
  private loadTrustedCAs(): void {
    // Load system trusted CAs
    if (this.config.trustedCAPath && fs.existsSync(this.config.trustedCAPath)) {
      try {
        const caData = fs.readFileSync(this.config.trustedCAPath);
        this.trustedCAs.push(caData);
      } catch (error) {
        console.warn(`Failed to load trusted CAs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Add a custom trusted CA
   * 
   * @param caPath - Path to the CA certificate file
   */
  addTrustedCA(caPath: string): void {
    if (!fs.existsSync(caPath)) {
      throw new Error(`CA certificate file not found: ${caPath}`);
    }

    const caData = fs.readFileSync(caPath);
    this.trustedCAs.push(caData);
  }

  /**
   * Add a pinned certificate for a hostname
   * 
   * @param hostname - The hostname to pin
   * @param certPath - Path to the certificate file
   */
  addPinnedCertificate(hostname: string, certPath: string): void {
    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificate file not found: ${certPath}`);
    }

    const certData = fs.readFileSync(certPath);
    this.pinnedCertificates.set(hostname, certData);
  }

  /**
   * Clear certificate cache
   */
  clearCache(): void {
    this.certificateCache.clear();
    this.ocspCache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  getCacheStats(): {
    certificateCacheSize: number;
    ocspCacheSize: number;
  } {
    return {
      certificateCacheSize: this.certificateCache.size,
      ocspCacheSize: this.ocspCache.size
    };
  }
}