/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EncryptionService, StorableEncryptedData } from './encryption/EncryptionService';
import { KeyManager } from './keys/KeyManager';
import { SecureHttpClient, SecureResponse } from './transport/SecureHttpClient';
import { CertificateValidator, CertificateValidationResult } from './certificates/CertificateValidator';

/**
 * Security configuration options
 */
export interface SecurityConfig {
  encryption?: {
    masterPassword?: string;
    keyRotationInterval?: number; // days
  };
  transport?: {
    enforceHttps?: boolean;
    certificatePinning?: boolean;
    tlsMinVersion?: string;
  };
  certificates?: {
    checkRevocation?: boolean;
    checkCertificateTransparency?: boolean;
    warningDaysBeforeExpiration?: number;
  };
  keyManagement?: {
    configDir?: string;
    autoBackup?: boolean;
  };
}

/**
 * Security audit log entry
 */
export interface SecurityAuditEntry {
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: Record<string, any>;
  source: string;
}

/**
 * Security health check result
 */
export interface SecurityHealthCheck {
  overall: 'healthy' | 'warning' | 'critical';
  checks: {
    encryption: 'pass' | 'fail' | 'warning';
    keyManagement: 'pass' | 'fail' | 'warning';
    transport: 'pass' | 'fail' | 'warning';
    certificates: 'pass' | 'fail' | 'warning';
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Central security manager for Convergio CLI
 * 
 * Provides unified access to all security services including:
 * - Data encryption and decryption
 * - Key management and rotation
 * - Secure HTTP communication
 * - Certificate validation and monitoring
 * - Security auditing and health checks
 */
export class SecurityManager {
  private readonly encryptionService: EncryptionService;
  private readonly keyManager: KeyManager;
  private readonly httpClient: SecureHttpClient;
  private readonly certificateValidator: CertificateValidator;
  private readonly config: SecurityConfig;
  private readonly auditLog: SecurityAuditEntry[] = [];
  private isInitialized = false;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      encryption: {
        keyRotationInterval: 90,
        ...config.encryption
      },
      transport: {
        enforceHttps: true,
        certificatePinning: true,
        tlsMinVersion: 'TLSv1.3',
        ...config.transport
      },
      certificates: {
        checkRevocation: true,
        checkCertificateTransparency: false,
        warningDaysBeforeExpiration: 30,
        ...config.certificates
      },
      keyManagement: {
        autoBackup: true,
        ...config.keyManagement
      }
    };

    this.encryptionService = new EncryptionService();
    this.keyManager = new KeyManager(this.config.keyManagement?.configDir);
    this.httpClient = new SecureHttpClient({
      minVersion: this.config.transport?.tlsMinVersion,
      maxVersion: this.config.transport?.tlsMinVersion
    });
    this.certificateValidator = new CertificateValidator(this.config.certificates);

    this.log('info', 'SecurityManager initialized', { config: this.sanitizeConfig(config) });
  }

  /**
   * Initialize the security manager
   * 
   * @param masterPassword - Password for master key initialization
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(masterPassword?: string): Promise<void> {
    try {
      // Initialize key manager
      if (masterPassword) {
        await this.keyManager.initialize(masterPassword);
        this.log('info', 'Key manager initialized', {});
      }

      this.isInitialized = true;
      this.log('info', 'SecurityManager fully initialized', {});
    } catch (error) {
      this.log('error', 'SecurityManager initialization failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Check if security manager is initialized
   * 
   * @returns True if initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // ===== ENCRYPTION METHODS =====

  /**
   * Encrypt sensitive data
   * 
   * @param data - Data to encrypt
   * @param password - Password for encryption
   * @returns Promise resolving to encrypted data
   */
  async encryptData(data: string, password: string): Promise<StorableEncryptedData> {
    try {
      const result = await this.encryptionService.encryptToStorable(data, password);
      this.log('info', 'Data encrypted successfully', { 
        algorithm: result.algorithm,
        version: result.version 
      });
      return result;
    } catch (error) {
      this.log('error', 'Data encryption failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   * 
   * @param encryptedData - Encrypted data to decrypt
   * @param password - Password for decryption
   * @returns Promise resolving to decrypted data
   */
  async decryptData(encryptedData: StorableEncryptedData, password: string): Promise<string> {
    try {
      const result = await this.encryptionService.decryptFromStorable(encryptedData, password);
      this.log('info', 'Data decrypted successfully', { 
        algorithm: encryptedData.algorithm,
        version: encryptedData.version 
      });
      return result;
    } catch (error) {
      this.log('error', 'Data decryption failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  // ===== KEY MANAGEMENT METHODS =====

  /**
   * Create a new data encryption key
   * 
   * @param keyId - Unique identifier for the key
   * @param masterPassword - Master password
   * @param description - Optional description
   * @returns Promise that resolves when key is created
   */
  async createEncryptionKey(
    keyId: string, 
    masterPassword: string, 
    description?: string
  ): Promise<void> {
    this.ensureInitialized();
    try {
      await this.keyManager.createDataEncryptionKey(keyId, masterPassword, description);
      
      if (this.config.keyManagement?.autoBackup) {
        await this.keyManager.backupKey(keyId);
      }

      this.log('info', 'Encryption key created', { keyId, description });
    } catch (error) {
      this.log('error', 'Encryption key creation failed', { 
        keyId,
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Rotate an encryption key
   * 
   * @param keyId - Key identifier to rotate
   * @param masterPassword - Master password
   * @returns Promise resolving to rotation result
   */
  async rotateEncryptionKey(keyId: string, masterPassword: string) {
    this.ensureInitialized();
    try {
      const result = await this.keyManager.rotateKey(keyId, masterPassword);
      this.log('info', 'Encryption key rotated', {
        oldKeyId: result.oldKeyId,
        newKeyId: result.newKeyId,
        timestamp: result.timestamp
      });
      return result;
    } catch (error) {
      this.log('error', 'Encryption key rotation failed', {
        keyId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * List all available encryption keys
   * 
   * @returns Promise resolving to array of key metadata
   */
  async listEncryptionKeys() {
    this.ensureInitialized();
    try {
      const keys = await this.keyManager.listKeys();
      this.log('info', 'Listed encryption keys', { count: keys.length });
      return keys;
    } catch (error) {
      this.log('error', 'Failed to list encryption keys', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ===== SECURE HTTP METHODS =====

  /**
   * Make a secure HTTP request
   * 
   * @param url - URL to request
   * @param options - Request options
   * @returns Promise resolving to secure response
   */
  async secureRequest<T = any>(url: string, options: any = {}): Promise<SecureResponse<T>> {
    try {
      // Enforce HTTPS if configured
      if (this.config.transport?.enforceHttps && !url.startsWith('https://')) {
        throw new Error('HTTPS is required for all requests');
      }

      const response = await this.httpClient.request<T>(url, options);
      
      this.log('info', 'Secure HTTP request completed', {
        method: options.method || 'GET',
        status: response.status,
        timing: response.timing.total
      });

      return response;
    } catch (error) {
      this.log('error', 'Secure HTTP request failed', {
        url,
        method: options.method || 'GET',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Add certificate pin for a hostname
   * 
   * @param hostname - Hostname to pin
   * @param publicKeyHash - Public key hash
   * @param algorithm - Hash algorithm
   */
  addCertificatePin(
    hostname: string, 
    publicKeyHash: string, 
    algorithm: 'sha256' | 'sha1' = 'sha256'
  ): void {
    this.httpClient.addCertificatePin(hostname, publicKeyHash, algorithm);
    this.log('info', 'Certificate pin added', { hostname, algorithm });
  }

  // ===== CERTIFICATE VALIDATION METHODS =====

  /**
   * Validate a server certificate
   * 
   * @param hostname - Server hostname
   * @param port - Server port
   * @returns Promise resolving to validation result
   */
  async validateServerCertificate(
    hostname: string, 
    port: number = 443
  ): Promise<CertificateValidationResult> {
    try {
      const result = await this.certificateValidator.validateServerCertificate(hostname, port);
      
      this.log(
        result.isValid ? 'info' : 'warning',
        'Server certificate validated',
        {
          hostname,
          port,
          isValid: result.isValid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length
        }
      );

      return result;
    } catch (error) {
      this.log('error', 'Server certificate validation failed', {
        hostname,
        port,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check certificate expiration for a server
   * 
   * @param hostname - Server hostname
   * @param port - Server port
   * @returns Promise resolving to certificate expiration info
   */
  async checkCertificateExpiration(hostname: string, port: number = 443) {
    try {
      const result = await this.httpClient.checkCertificateExpiration(hostname, port);
      
      this.log(
        result.isExpiringSoon ? 'warning' : 'info',
        'Certificate expiration checked',
        {
          hostname,
          port,
          daysUntilExpiration: result.daysUntilExpiration,
          isExpiringSoon: result.isExpiringSoon
        }
      );

      return result;
    } catch (error) {
      this.log('error', 'Certificate expiration check failed', {
        hostname,
        port,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // ===== SECURITY MONITORING METHODS =====

  /**
   * Perform security health check
   * 
   * @returns Promise resolving to health check result
   */
  async performHealthCheck(): Promise<SecurityHealthCheck> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check encryption service
    const encryptionCheck = this.checkEncryptionHealth();
    if (encryptionCheck !== 'pass') {
      issues.push('Encryption service issues detected');
      recommendations.push('Review encryption configuration and key management');
    }

    // Check key management
    const keyManagementCheck = await this.checkKeyManagementHealth();
    if (keyManagementCheck !== 'pass') {
      issues.push('Key management issues detected');
      recommendations.push('Verify master key access and key rotation schedule');
    }

    // Check transport security
    const transportCheck = this.checkTransportHealth();
    if (transportCheck !== 'pass') {
      issues.push('Transport security issues detected');
      recommendations.push('Review TLS configuration and certificate settings');
    }

    // Check certificate validation
    const certificateCheck = this.checkCertificateHealth();
    if (certificateCheck !== 'pass') {
      issues.push('Certificate validation issues detected');
      recommendations.push('Update certificate validation settings');
    }

    const overall = issues.length === 0 ? 'healthy' : 
                   issues.length <= 2 ? 'warning' : 'critical';

    const result: SecurityHealthCheck = {
      overall,
      checks: {
        encryption: encryptionCheck,
        keyManagement: keyManagementCheck,
        transport: transportCheck,
        certificates: certificateCheck
      },
      issues,
      recommendations
    };

    this.log('info', 'Security health check completed', {
      overall,
      issueCount: issues.length,
      recommendationCount: recommendations.length
    });

    return result;
  }

  /**
   * Get security audit log
   * 
   * @param limit - Maximum number of entries to return
   * @returns Array of audit log entries
   */
  getAuditLog(limit: number = 100): SecurityAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Clear security audit log
   */
  clearAuditLog(): void {
    this.auditLog.length = 0;
    this.log('info', 'Security audit log cleared', {});
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Ensure security manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('SecurityManager must be initialized before use');
    }
  }

  /**
   * Log security event
   * 
   * @param severity - Event severity
   * @param event - Event description
   * @param details - Event details
   */
  private log(
    severity: 'info' | 'warning' | 'error' | 'critical',
    event: string,
    details: Record<string, any>
  ): void {
    const entry: SecurityAuditEntry = {
      timestamp: new Date().toISOString(),
      event,
      severity,
      details,
      source: 'SecurityManager'
    };

    this.auditLog.push(entry);

    // Keep only last 1000 entries to prevent memory issues
    if (this.auditLog.length > 1000) {
      this.auditLog.splice(0, this.auditLog.length - 1000);
    }

    // Log critical and error events to console
    if (severity === 'critical' || severity === 'error') {
      console.error(`[SecurityManager] ${event}:`, details);
    }
  }

  /**
   * Sanitize configuration for logging
   * 
   * @param config - Configuration to sanitize
   * @returns Sanitized configuration
   */
  private sanitizeConfig(config: SecurityConfig): any {
    return {
      ...config,
      encryption: {
        ...config.encryption,
        masterPassword: config.encryption?.masterPassword ? '[REDACTED]' : undefined
      }
    };
  }

  /**
   * Check encryption service health
   * 
   * @returns Health check result
   */
  private checkEncryptionHealth(): 'pass' | 'fail' | 'warning' {
    try {
      // Test encryption service
      const info = this.encryptionService.getInfo();
      if (info.algorithm === 'aes-256-gcm' && info.keyLength === 32) {
        return 'pass';
      }
      return 'warning';
    } catch {
      return 'fail';
    }
  }

  /**
   * Check key management health
   * 
   * @returns Promise resolving to health check result
   */
  private async checkKeyManagementHealth(): Promise<'pass' | 'fail' | 'warning'> {
    try {
      const hasMasterKey = await this.keyManager.hasMasterKey();
      return hasMasterKey ? 'pass' : 'warning';
    } catch {
      return 'fail';
    }
  }

  /**
   * Check transport security health
   * 
   * @returns Health check result
   */
  private checkTransportHealth(): 'pass' | 'fail' | 'warning' {
    // Check if TLS 1.3 is enforced
    if (this.config.transport?.tlsMinVersion === 'TLSv1.3') {
      return 'pass';
    } else if (this.config.transport?.tlsMinVersion === 'TLSv1.2') {
      return 'warning';
    }
    return 'fail';
  }

  /**
   * Check certificate validation health
   * 
   * @returns Health check result
   */
  private checkCertificateHealth(): 'pass' | 'fail' | 'warning' {
    if (this.config.certificates?.checkRevocation) {
      return 'pass';
    }
    return 'warning';
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.certificateValidator.clearCache();
    this.clearAuditLog();
    this.log('info', 'SecurityManager cleanup completed', {});
  }
}