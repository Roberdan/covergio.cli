/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  salt: Buffer;
}

/**
 * Encrypted data in storable format
 */
export interface StorableEncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
  algorithm: string;
  version: number;
  timestamp: string;
}

/**
 * Key derivation result
 */
export interface DerivedKey {
  key: Buffer;
  salt: Buffer;
}

/**
 * AES-256 encryption service with authenticated encryption
 * 
 * Uses AES-256-GCM for authenticated encryption providing both
 * confidentiality and authenticity. Implements secure key derivation
 * using scrypt with appropriate parameters for 2025 security standards.
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly scryptOptions = {
    N: 16384, // Cost factor (2^14)
    r: 8,     // Block size
    p: 1      // Parallelization factor
  };

  /**
   * Derive a key from a password using scrypt
   * 
   * @param password - The password to derive the key from
   * @param salt - Optional salt (will generate if not provided)
   * @returns Promise resolving to derived key and salt
   */
  async deriveKey(password: string, salt?: Buffer): Promise<DerivedKey> {
    const saltBuffer = salt || randomBytes(this.saltLength);
    const scryptAsync = promisify(scrypt);
    
    const key = await scryptAsync(
      password, 
      saltBuffer, 
      this.keyLength,
      {
        N: this.scryptOptions.N,
        r: this.scryptOptions.r,
        p: this.scryptOptions.p
      }
    ) as Buffer;
    
    return { key, salt: saltBuffer };
  }

  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param data - The data to encrypt
   * @param password - The password to derive encryption key from
   * @returns Promise resolving to encrypted data structure
   */
  async encrypt(data: string, password: string): Promise<EncryptedData> {
    const iv = randomBytes(this.ivLength);
    const { key, salt } = await this.deriveKey(password);
    
    const cipher = createCipheriv(this.algorithm, key, iv, { 
      authTagLength: this.tagLength 
    });
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data, 'utf8')),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Clear the key from memory
    this.clearSensitiveData(key);
    
    return { encrypted, iv, tag, salt };
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param encrypted - The encrypted data buffer
   * @param iv - The initialization vector
   * @param tag - The authentication tag
   * @param salt - The salt used for key derivation
   * @param password - The password to derive decryption key from
   * @returns Promise resolving to decrypted data
   */
  async decrypt(
    encrypted: Buffer,
    iv: Buffer,
    tag: Buffer,
    salt: Buffer,
    password: string
  ): Promise<string> {
    const { key } = await this.deriveKey(password, salt);
    
    const decipher = createDecipheriv(this.algorithm, key, iv, { 
      authTagLength: this.tagLength 
    });
    decipher.setAuthTag(tag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      // Clear the key from memory
      this.clearSensitiveData(key);
      
      return decrypted.toString('utf8');
    } catch (error) {
      // Clear the key from memory even on error
      this.clearSensitiveData(key);
      throw new Error('Decryption failed: Invalid password or corrupted data');
    }
  }

  /**
   * Encrypt data and return in storable format
   * 
   * @param data - The data to encrypt
   * @param password - The password to derive encryption key from
   * @returns Promise resolving to storable encrypted data
   */
  async encryptToStorable(data: string, password: string): Promise<StorableEncryptedData> {
    const result = await this.encrypt(data, password);
    
    const storableData: StorableEncryptedData = {
      encrypted: result.encrypted.toString('base64'),
      iv: result.iv.toString('base64'),
      tag: result.tag.toString('base64'),
      salt: result.salt.toString('base64'),
      algorithm: this.algorithm,
      version: 1,
      timestamp: new Date().toISOString()
    };
    
    // Clear sensitive data from memory
    this.clearSensitiveData(result.encrypted);
    this.clearSensitiveData(result.iv);
    this.clearSensitiveData(result.tag);
    this.clearSensitiveData(result.salt);
    
    return storableData;
  }

  /**
   * Decrypt data from storable format
   * 
   * @param storableData - The storable encrypted data
   * @param password - The password to derive decryption key from
   * @returns Promise resolving to decrypted data
   */
  async decryptFromStorable(
    storableData: StorableEncryptedData, 
    password: string
  ): Promise<string> {
    // Validate the storable data format
    this.validateStorableData(storableData);
    
    return await this.decrypt(
      Buffer.from(storableData.encrypted, 'base64'),
      Buffer.from(storableData.iv, 'base64'),
      Buffer.from(storableData.tag, 'base64'),
      Buffer.from(storableData.salt, 'base64'),
      password
    );
  }

  /**
   * Generate a random encryption key
   * 
   * @returns Random 256-bit key
   */
  generateKey(): Buffer {
    return randomBytes(this.keyLength);
  }

  /**
   * Encrypt data with a provided key (no password derivation)
   * 
   * @param data - The data to encrypt
   * @param key - The encryption key (32 bytes)
   * @returns Encrypted data structure
   */
  encryptWithKey(data: string, key: Buffer): EncryptedData {
    if (key.length !== this.keyLength) {
      throw new Error(`Key must be ${this.keyLength} bytes long`);
    }
    
    const iv = randomBytes(this.ivLength);
    const salt = randomBytes(this.saltLength); // Not used but included for consistency
    
    const cipher = createCipheriv(this.algorithm, key, iv, { 
      authTagLength: this.tagLength 
    });
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(data, 'utf8')),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return { encrypted, iv, tag, salt };
  }

  /**
   * Decrypt data with a provided key (no password derivation)
   * 
   * @param encrypted - The encrypted data buffer
   * @param iv - The initialization vector
   * @param tag - The authentication tag
   * @param key - The decryption key (32 bytes)
   * @returns Decrypted data
   */
  decryptWithKey(
    encrypted: Buffer,
    iv: Buffer,
    tag: Buffer,
    key: Buffer
  ): string {
    if (key.length !== this.keyLength) {
      throw new Error(`Key must be ${this.keyLength} bytes long`);
    }
    
    const decipher = createDecipheriv(this.algorithm, key, iv, { 
      authTagLength: this.tagLength 
    });
    decipher.setAuthTag(tag);
    
    try {
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
  }

  /**
   * Validate storable encrypted data format
   * 
   * @param data - The storable data to validate
   * @throws Error if data is invalid
   */
  private validateStorableData(data: StorableEncryptedData): void {
    const requiredFields = ['encrypted', 'iv', 'tag', 'salt', 'algorithm', 'version'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Invalid encrypted data: missing field '${field}'`);
      }
    }
    
    if (data.algorithm !== this.algorithm) {
      throw new Error(`Unsupported encryption algorithm: ${data.algorithm}`);
    }
    
    if (data.version !== 1) {
      throw new Error(`Unsupported encryption version: ${data.version}`);
    }
    
    // Validate base64 encoding
    try {
      Buffer.from(data.encrypted, 'base64');
      Buffer.from(data.iv, 'base64');
      Buffer.from(data.tag, 'base64');
      Buffer.from(data.salt, 'base64');
    } catch (error) {
      throw new Error('Invalid encrypted data: corrupted base64 encoding');
    }
  }

  /**
   * Clear sensitive data from memory
   * 
   * @param buffer - The buffer to clear
   */
  private clearSensitiveData(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      buffer.fill(0);
    }
  }

  /**
   * Securely compare two buffers to prevent timing attacks
   * 
   * @param a - First buffer
   * @param b - Second buffer
   * @returns True if buffers are equal
   */
  secureCompare(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }

  /**
   * Get encryption service information
   * 
   * @returns Service information
   */
  getInfo(): {
    algorithm: string;
    keyLength: number;
    saltLength: number;
    ivLength: number;
    tagLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      saltLength: this.saltLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength
    };
  }
}