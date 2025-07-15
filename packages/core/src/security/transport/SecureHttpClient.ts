/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { URL } from 'url';

/**
 * Certificate pinning configuration
 */
export interface CertificatePinConfig {
  hostname: string;
  publicKeyHash: string;
  algorithm: 'sha256' | 'sha1';
}

/**
 * TLS configuration options
 */
export interface TLSConfig {
  minVersion?: string;
  maxVersion?: string;
  ciphers?: string[];
  rejectUnauthorized?: boolean;
  checkServerIdentity?: (hostname: string, cert: any) => Error | undefined;
  ca?: Buffer | Buffer[];
  cert?: Buffer;
  key?: Buffer;
  passphrase?: string;
}

/**
 * HTTP request options
 */
export interface SecureRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  validateStatus?: (status: number) => boolean;
}

/**
 * Request/Response timing information
 */
export interface RequestTiming {
  dns?: number;
  connect?: number;
  tls?: number;
  firstByte?: number;
  total: number;
}

/**
 * Enhanced response interface
 */
export interface SecureResponse<T = any> extends Response {
  data: T;
  timing: RequestTiming;
  certificateInfo?: tls.PeerCertificate;
}

/**
 * Error interface for HTTP errors
 */
export interface HttpError extends Error {
  status?: number;
  statusText?: string;
  response?: Response;
  timing?: RequestTiming;
}

/**
 * Secure HTTP client with TLS 1.3 enforcement and certificate validation
 * 
 * Provides secure HTTPS communication with:
 * - TLS 1.3 enforcement
 * - Certificate pinning support
 * - Strong cipher suite selection
 * - Request/response timing
 * - Automatic retries with exponential backoff
 * - Certificate validation and monitoring
 */
export class SecureHttpClient {
  private readonly tlsConfig: TLSConfig;
  private readonly pinnedCertificates: Map<string, CertificatePinConfig> = new Map();
  private readonly userAgent: string;
  
  // Default strong cipher suites for TLS 1.3
  private readonly defaultCiphers = [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ];

  constructor(
    tlsConfig: Partial<TLSConfig> = {},
    userAgent: string = 'Convergio-CLI/1.0'
  ) {
    this.userAgent = userAgent;
    this.tlsConfig = {
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
      ciphers: this.defaultCiphers,
      rejectUnauthorized: true,
      checkServerIdentity: this.createServerIdentityChecker(),
      ...tlsConfig
    };
  }

  /**
   * Add certificate pin for a hostname
   * 
   * @param hostname - The hostname to pin
   * @param publicKeyHash - The public key hash (without "sha256/" prefix)
   * @param algorithm - Hash algorithm used
   */
  addCertificatePin(
    hostname: string,
    publicKeyHash: string,
    algorithm: 'sha256' | 'sha1' = 'sha256'
  ): void {
    this.pinnedCertificates.set(hostname, {
      hostname,
      publicKeyHash,
      algorithm
    });
  }

  /**
   * Load certificate pins from a configuration file
   * 
   * @param configPath - Path to the certificate pins configuration file
   */
  loadCertificatePins(configPath: string): void {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Certificate pins configuration file not found: ${configPath}`);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (config.pins && Array.isArray(config.pins)) {
      for (const pin of config.pins) {
        this.addCertificatePin(pin.hostname, pin.publicKeyHash, pin.algorithm);
      }
    }
  }

  /**
   * Make a secure HTTP request
   * 
   * @param url - The URL to request
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async request<T = any>(
    url: string,
    options: SecureRequestOptions = {}
  ): Promise<SecureResponse<T>> {
    const {
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      validateStatus = (status) => status >= 200 && status < 300,
      ...fetchOptions
    } = options;

    const parsedUrl = new URL(url);
    
    // Validate HTTPS protocol
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS requests are allowed');
    }

    const agent = this.createSecureAgent(parsedUrl.hostname);
    const startTime = Date.now();
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.makeRequest<T>(
          url,
          {
            ...fetchOptions,
            agent,
            timeout
          },
          startTime
        );
        
        if (!validateStatus(response.status)) {
          const error: HttpError = new Error(
            `HTTP error ${response.status}: ${response.statusText}`
          );
          error.status = response.status;
          error.statusText = response.statusText;
          error.response = response;
          error.timing = response.timing;
          throw error;
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx) or certain network errors
        if (this.shouldNotRetry(error as HttpError, attempt, retries)) {
          throw error;
        }
        
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Make a GET request
   * 
   * @param url - The URL to request
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async get<T = any>(
    url: string,
    options: Omit<SecureRequestOptions, 'method' | 'body'> = {}
  ): Promise<SecureResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   * 
   * @param url - The URL to request
   * @param data - Request body data
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async post<T = any>(
    url: string,
    data?: any,
    options: Omit<SecureRequestOptions, 'method'> = {}
  ): Promise<SecureResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body,
      headers
    });
  }

  /**
   * Make a PUT request
   * 
   * @param url - The URL to request
   * @param data - Request body data
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async put<T = any>(
    url: string,
    data?: any,
    options: Omit<SecureRequestOptions, 'method'> = {}
  ): Promise<SecureResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body,
      headers
    });
  }

  /**
   * Make a DELETE request
   * 
   * @param url - The URL to request
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async delete<T = any>(
    url: string,
    options: Omit<SecureRequestOptions, 'method' | 'body'> = {}
  ): Promise<SecureResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Check server certificate expiration
   * 
   * @param hostname - The hostname to check
   * @param port - The port to connect to
   * @returns Promise resolving to certificate information
   */
  async checkCertificateExpiration(
    hostname: string,
    port: number = 443
  ): Promise<{
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    daysUntilExpiration: number;
    isExpiringSoon: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: hostname,
        port,
        minVersion: 'TLSv1.3',
        rejectUnauthorized: false // We're just checking certificate info
      }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        
        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error('No certificate provided by server'));
          return;
        }
        
        const now = new Date();
        const validTo = new Date(cert.valid_to);
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiration = Math.floor((validTo.getTime() - now.getTime()) / msPerDay);
        
        resolve({
          subject: cert.subject?.CN || 'Unknown',
          issuer: cert.issuer?.CN || 'Unknown',
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiration,
          isExpiringSoon: daysUntilExpiration <= 30
        });
      });
      
      socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Create a secure HTTPS agent
   * 
   * @param hostname - The hostname for the request
   * @returns HTTPS agent with secure configuration
   */
  private createSecureAgent(hostname: string): https.Agent {
    return new https.Agent({
      ...this.tlsConfig,
      checkServerIdentity: (host, cert) => {
        // Standard hostname verification
        const error = tls.checkServerIdentity(host, cert);
        if (error) {
          return error;
        }
        
        // Certificate pinning check
        const pinConfig = this.pinnedCertificates.get(hostname);
        if (pinConfig) {
          const isValid = this.verifyCertificatePin(cert, pinConfig);
          if (!isValid) {
            return new Error(`Certificate pinning verification failed for ${hostname}`);
          }
        }
        
        return undefined; // Validation successful
      }
    });
  }

  /**
   * Create server identity checker
   * 
   * @returns Server identity checker function
   */
  private createServerIdentityChecker(): (hostname: string, cert: any) => Error | undefined {
    return (hostname: string, cert: any) => {
      return this.tlsConfig.checkServerIdentity?.(hostname, cert);
    };
  }

  /**
   * Verify certificate pin
   * 
   * @param cert - The certificate to verify
   * @param pinConfig - The pin configuration
   * @returns True if certificate matches the pin
   */
  private verifyCertificatePin(cert: any, pinConfig: CertificatePinConfig): boolean {
    try {
      const publicKey = cert.pubkey;
      const hash = crypto.createHash(pinConfig.algorithm).update(publicKey).digest('base64');
      return hash === pinConfig.publicKeyHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make the actual HTTP request
   * 
   * @param url - The URL to request
   * @param options - Fetch options
   * @param startTime - Request start time
   * @returns Promise resolving to secure response
   */
  private async makeRequest<T>(
    url: string,
    options: RequestInit & { agent: https.Agent; timeout: number },
    startTime: number
  ): Promise<SecureResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          ...options.headers
        }
      }) as Response;
      
      clearTimeout(timeoutId);
      
      const endTime = Date.now();
      const timing: RequestTiming = {
        total: endTime - startTime
      };
      
      // Parse response data
      let data: T;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text() as unknown as T;
      } else {
        data = await response.arrayBuffer() as unknown as T;
      }
      
      // Create enhanced response
      const secureResponse: SecureResponse<T> = Object.assign(response, {
        data,
        timing
      });
      
      return secureResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Determine if request should not be retried
   * 
   * @param error - The error that occurred
   * @param attempt - Current attempt number
   * @param maxRetries - Maximum number of retries
   * @returns True if request should not be retried
   */
  private shouldNotRetry(error: HttpError, attempt: number, maxRetries: number): boolean {
    // Don't retry if we've exhausted all attempts
    if (attempt >= maxRetries) {
      return true;
    }
    
    // Don't retry on client errors (4xx)
    if (error.status && error.status >= 400 && error.status < 500) {
      return true;
    }
    
    // Don't retry on certificate/TLS errors
    if (error.message.includes('certificate') || error.message.includes('TLS')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   * @returns Promise that resolves after the duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}