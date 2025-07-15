/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Main Security Manager
export { SecurityManager } from './SecurityManager';
export type { 
  SecurityConfig, 
  SecurityAuditEntry, 
  SecurityHealthCheck 
} from './SecurityManager';

// Encryption Services
export { EncryptionService } from './encryption/EncryptionService';
export type { 
  EncryptedData, 
  StorableEncryptedData, 
  DerivedKey 
} from './encryption/EncryptionService';

// Key Management
export { KeyManager } from './keys/KeyManager';
export type { 
  KeyMetadata, 
  EncryptedKeyData, 
  KeyRotationResult 
} from './keys/KeyManager';

// Secure Transport
export { SecureHttpClient } from './transport/SecureHttpClient';
export type { 
  CertificatePinConfig, 
  TLSConfig, 
  SecureRequestOptions, 
  RequestTiming, 
  SecureResponse, 
  HttpError 
} from './transport/SecureHttpClient';

// Certificate Validation
export { CertificateValidator } from './certificates/CertificateValidator';
export type { 
  CertificateValidationResult, 
  CertificateChainValidationResult, 
  OCSPResponse, 
  CTLogEntry, 
  CertificateValidationConfig 
} from './certificates/CertificateValidator';

/**
 * Security module version and information
 */
export const SECURITY_VERSION = '1.0.0';
export const SUPPORTED_ALGORITHMS = ['aes-256-gcm'] as const;
export const SUPPORTED_TLS_VERSIONS = ['TLSv1.3', 'TLSv1.2'] as const;

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG = {
  encryption: {
    keyRotationInterval: 90,
  },
  transport: {
    enforceHttps: true,
    certificatePinning: true,
    tlsMinVersion: 'TLSv1.3' as const,
  },
  certificates: {
    checkRevocation: true,
    checkCertificateTransparency: false,
    warningDaysBeforeExpiration: 30,
  },
  keyManagement: {
    autoBackup: true,
  }
} as const;