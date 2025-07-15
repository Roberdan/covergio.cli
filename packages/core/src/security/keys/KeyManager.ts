/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes, createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { promisify } from 'util';

/**
 * Key storage metadata
 */
export interface KeyMetadata {
  keyId: string;
  version: number;
  algorithm: string;
  createdAt: string;
  lastUsed?: string;
  expiresAt?: string;
  description?: string;
}

/**
 * Encrypted key data structure
 */
export interface EncryptedKeyData {
  salt: string;
  iv: string;
  tag: string;
  encryptedKey: string;
  metadata: KeyMetadata;
}

/**
 * Key rotation result
 */
export interface KeyRotationResult {
  oldKeyId: string;
  newKeyId: string;
  timestamp: string;
}

/**
 * Secure key management system with hierarchical key structure
 * 
 * Implements a master key that encrypts data encryption keys (DEKs).
 * Provides secure storage using the system's capabilities and implements
 * key rotation, backup, and recovery mechanisms.
 */
export class KeyManager {
  private readonly service = 'convergio-cli';
  private readonly masterKeyAccount = 'master-key';
  private readonly configDir: string;
  private readonly keysDir: string;
  private readonly backupDir: string;
  
  // Key management configuration
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly algorithm = 'aes-256-gcm';

  constructor(configDir?: string) {
    this.configDir = configDir || path.join(os.homedir(), '.convergio');
    this.keysDir = path.join(this.configDir, 'keys');
    this.backupDir = path.join(this.configDir, 'backups');
    
    this.ensureDirectoryStructure();
  }

  /**
   * Initialize the key manager and create master key if it doesn't exist
   * 
   * @param masterPassword - Password for the master key
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(masterPassword: string): Promise<void> {
    if (!await this.hasMasterKey()) {
      await this.createMasterKey(masterPassword);
    }
  }

  /**
   * Check if a master key exists
   * 
   * @returns Promise resolving to true if master key exists
   */
  async hasMasterKey(): Promise<boolean> {
    const masterKeyPath = path.join(this.keysDir, 'master-key.json');
    return fs.existsSync(masterKeyPath);
  }

  /**
   * Create a new master key
   * 
   * @param password - Password to protect the master key
   * @returns Promise that resolves when master key is created
   */
  async createMasterKey(password: string): Promise<void> {
    const masterKey = randomBytes(this.keyLength);
    const salt = randomBytes(this.saltLength);
    
    // Derive a key from the password using scrypt
    const scryptAsync = promisify(scrypt);
    const derivedKey = await scryptAsync(password, salt, this.keyLength, {
      N: 16384,
      r: 8,
      p: 1
    }) as Buffer;
    
    // Encrypt the master key with the derived key
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Create master key metadata
    const metadata: KeyMetadata = {
      keyId: 'master-key',
      version: 1,
      algorithm: this.algorithm,
      createdAt: new Date().toISOString(),
      description: 'Master encryption key for Convergio CLI'
    };
    
    // Store the encrypted master key
    const keyData: EncryptedKeyData = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encryptedKey: encrypted.toString('hex'),
      metadata
    };
    
    const masterKeyPath = path.join(this.keysDir, 'master-key.json');
    fs.writeFileSync(
      masterKeyPath,
      JSON.stringify(keyData, null, 2),
      { mode: 0o600 } // Secure file permissions
    );
    
    // Clear sensitive data from memory
    this.clearSensitiveData(masterKey);
    this.clearSensitiveData(derivedKey);
    this.clearSensitiveData(encrypted);
    
    // Create backup
    await this.backupMasterKey();
  }

  /**
   * Retrieve and decrypt the master key
   * 
   * @param password - Password to decrypt the master key
   * @returns Promise resolving to the master key buffer
   */
  async getMasterKey(password: string): Promise<Buffer> {
    const masterKeyPath = path.join(this.keysDir, 'master-key.json');
    if (!fs.existsSync(masterKeyPath)) {
      throw new Error('Master key not found. Please initialize the key manager first.');
    }
    
    const keyData: EncryptedKeyData = JSON.parse(fs.readFileSync(masterKeyPath, 'utf8'));
    
    // Derive the key from the password
    const salt = Buffer.from(keyData.salt, 'hex');
    const scryptAsync = promisify(scrypt);
    const derivedKey = await scryptAsync(password, salt, this.keyLength, {
      N: 16384,
      r: 8,
      p: 1
    }) as Buffer;
    
    // Decrypt the master key
    const iv = Buffer.from(keyData.iv, 'hex');
    const tag = Buffer.from(keyData.tag, 'hex');
    const encryptedKey = Buffer.from(keyData.encryptedKey, 'hex');
    
    const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    try {
      const masterKey = Buffer.concat([
        decipher.update(encryptedKey),
        decipher.final()
      ]);
      
      // Clear the derived key from memory
      this.clearSensitiveData(derivedKey);
      
      // Update last used timestamp
      keyData.metadata.lastUsed = new Date().toISOString();
      fs.writeFileSync(masterKeyPath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
      
      return masterKey;
    } catch (error) {
      // Clear the derived key from memory even on error
      this.clearSensitiveData(derivedKey);
      throw new Error('Failed to decrypt master key: Invalid password');
    }
  }

  /**
   * Create a new data encryption key (DEK)
   * 
   * @param keyId - Unique identifier for the key
   * @param masterPassword - Password for the master key
   * @param description - Optional description for the key
   * @returns Promise that resolves when the key is created
   */
  async createDataEncryptionKey(
    keyId: string,
    masterPassword: string,
    description?: string
  ): Promise<void> {
    if (await this.hasKey(keyId)) {
      throw new Error(`Key with ID '${keyId}' already exists`);
    }
    
    // Get the master key
    const masterKey = await this.getMasterKey(masterPassword);
    
    // Generate a new data encryption key
    const dataKey = randomBytes(this.keyLength);
    
    // Encrypt the data key with the master key
    const { encrypted, iv, tag } = await this.encryptWithMasterKey(dataKey, masterKey);
    
    // Create key metadata
    const metadata: KeyMetadata = {
      keyId,
      version: 1,
      algorithm: this.algorithm,
      createdAt: new Date().toISOString(),
      description
    };
    
    // Store the encrypted data key
    const keyData: EncryptedKeyData = {
      salt: randomBytes(this.saltLength).toString('hex'), // Not used but included for consistency
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encryptedKey: encrypted.toString('hex'),
      metadata
    };
    
    const keyPath = path.join(this.keysDir, `${keyId}.json`);
    fs.writeFileSync(
      keyPath,
      JSON.stringify(keyData, null, 2),
      { mode: 0o600 }
    );
    
    // Clear sensitive data from memory
    this.clearSensitiveData(masterKey);
    this.clearSensitiveData(dataKey);
    this.clearSensitiveData(encrypted);
  }

  /**
   * Retrieve a data encryption key
   * 
   * @param keyId - Unique identifier for the key
   * @param masterPassword - Password for the master key
   * @returns Promise resolving to the decrypted key buffer
   */
  async getDataEncryptionKey(keyId: string, masterPassword: string): Promise<Buffer> {
    const keyPath = path.join(this.keysDir, `${keyId}.json`);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Data encryption key '${keyId}' not found`);
    }
    
    // Get the master key
    const masterKey = await this.getMasterKey(masterPassword);
    
    // Load the encrypted data key
    const keyData: EncryptedKeyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    // Decrypt the data key
    const iv = Buffer.from(keyData.iv, 'hex');
    const tag = Buffer.from(keyData.tag, 'hex');
    const encryptedKey = Buffer.from(keyData.encryptedKey, 'hex');
    
    const dataKey = await this.decryptWithMasterKey(encryptedKey, iv, tag, masterKey);
    
    // Clear the master key from memory
    this.clearSensitiveData(masterKey);
    
    // Update last used timestamp
    keyData.metadata.lastUsed = new Date().toISOString();
    fs.writeFileSync(keyPath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
    
    return dataKey;
  }

  /**
   * Check if a key exists
   * 
   * @param keyId - Unique identifier for the key
   * @returns Promise resolving to true if key exists
   */
  async hasKey(keyId: string): Promise<boolean> {
    const keyPath = path.join(this.keysDir, `${keyId}.json`);
    return fs.existsSync(keyPath);
  }

  /**
   * Delete a data encryption key
   * 
   * @param keyId - Unique identifier for the key
   * @returns Promise that resolves when the key is deleted
   */
  async deleteKey(keyId: string): Promise<void> {
    const keyPath = path.join(this.keysDir, `${keyId}.json`);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Data encryption key '${keyId}' not found`);
    }
    
    // Create backup before deletion
    await this.backupKey(keyId);
    
    // Delete the key file
    fs.unlinkSync(keyPath);
  }

  /**
   * Rotate a data encryption key
   * 
   * @param keyId - Unique identifier for the key to rotate
   * @param masterPassword - Password for the master key
   * @returns Promise resolving to rotation result
   */
  async rotateKey(keyId: string, masterPassword: string): Promise<KeyRotationResult> {
    if (!await this.hasKey(keyId)) {
      throw new Error(`Data encryption key '${keyId}' not found`);
    }
    
    // Create backup of the old key
    await this.backupKey(keyId);
    
    // Get the old key metadata
    const oldKeyPath = path.join(this.keysDir, `${keyId}.json`);
    const oldKeyData: EncryptedKeyData = JSON.parse(fs.readFileSync(oldKeyPath, 'utf8'));
    
    // Create new key with incremented version
    const newKeyId = `${keyId}-v${oldKeyData.metadata.version + 1}`;
    const timestamp = new Date().toISOString();
    
    // Get the master key
    const masterKey = await this.getMasterKey(masterPassword);
    
    // Generate a new data encryption key
    const newDataKey = randomBytes(this.keyLength);
    
    // Encrypt the new data key with the master key
    const { encrypted, iv, tag } = await this.encryptWithMasterKey(newDataKey, masterKey);
    
    // Create new key metadata
    const newMetadata: KeyMetadata = {
      keyId: newKeyId,
      version: oldKeyData.metadata.version + 1,
      algorithm: this.algorithm,
      createdAt: timestamp,
      description: `Rotated from ${keyId} at ${timestamp}`
    };
    
    // Store the new encrypted data key
    const newKeyData: EncryptedKeyData = {
      salt: randomBytes(this.saltLength).toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encryptedKey: encrypted.toString('hex'),
      metadata: newMetadata
    };
    
    const newKeyPath = path.join(this.keysDir, `${newKeyId}.json`);
    fs.writeFileSync(
      newKeyPath,
      JSON.stringify(newKeyData, null, 2),
      { mode: 0o600 }
    );
    
    // Clear sensitive data from memory
    this.clearSensitiveData(masterKey);
    this.clearSensitiveData(newDataKey);
    this.clearSensitiveData(encrypted);
    
    return {
      oldKeyId: keyId,
      newKeyId,
      timestamp
    };
  }

  /**
   * List all available keys
   * 
   * @returns Promise resolving to array of key metadata
   */
  async listKeys(): Promise<KeyMetadata[]> {
    const keyFiles = fs.readdirSync(this.keysDir).filter(file => 
      file.endsWith('.json') && file !== 'master-key.json'
    );
    
    const keys: KeyMetadata[] = [];
    
    for (const file of keyFiles) {
      try {
        const keyData: EncryptedKeyData = JSON.parse(
          fs.readFileSync(path.join(this.keysDir, file), 'utf8')
        );
        keys.push(keyData.metadata);
      } catch (error) {
        // Skip corrupted key files
        console.warn(`Warning: Corrupted key file ${file}`);
      }
    }
    
    return keys.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Backup a key
   * 
   * @param keyId - Unique identifier for the key to backup
   * @returns Promise that resolves when backup is complete
   */
  async backupKey(keyId: string): Promise<void> {
    const keyPath = path.join(this.keysDir, `${keyId}.json`);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Data encryption key '${keyId}' not found`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `${keyId}-${timestamp}.json`);
    
    fs.copyFileSync(keyPath, backupPath);
    fs.chmodSync(backupPath, 0o600);
  }

  /**
   * Backup the master key
   * 
   * @returns Promise that resolves when backup is complete
   */
  async backupMasterKey(): Promise<void> {
    const masterKeyPath = path.join(this.keysDir, 'master-key.json');
    if (!fs.existsSync(masterKeyPath)) {
      throw new Error('Master key not found');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `master-key-${timestamp}.json`);
    
    fs.copyFileSync(masterKeyPath, backupPath);
    fs.chmodSync(backupPath, 0o600);
  }

  /**
   * Change master key password
   * 
   * @param oldPassword - Current master key password
   * @param newPassword - New master key password
   * @returns Promise that resolves when password is changed
   */
  async changeMasterKeyPassword(oldPassword: string, newPassword: string): Promise<void> {
    // Get the master key with the old password
    const masterKey = await this.getMasterKey(oldPassword);
    
    // Create backup before changing password
    await this.backupMasterKey();
    
    // Generate new salt and derive new key from new password
    const salt = randomBytes(this.saltLength);
    const scryptAsync = promisify(scrypt);
    const newDerivedKey = await scryptAsync(newPassword, salt, this.keyLength, {
      N: 16384,
      r: 8,
      p: 1
    }) as Buffer;
    
    // Encrypt the master key with the new derived key
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, newDerivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Load current metadata
    const masterKeyPath = path.join(this.keysDir, 'master-key.json');
    const currentData: EncryptedKeyData = JSON.parse(fs.readFileSync(masterKeyPath, 'utf8'));
    
    // Update the encrypted master key data
    const updatedData: EncryptedKeyData = {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encryptedKey: encrypted.toString('hex'),
      metadata: {
        ...currentData.metadata,
        version: currentData.metadata.version + 1,
        lastUsed: new Date().toISOString()
      }
    };
    
    // Save the updated master key
    fs.writeFileSync(
      masterKeyPath,
      JSON.stringify(updatedData, null, 2),
      { mode: 0o600 }
    );
    
    // Clear sensitive data from memory
    this.clearSensitiveData(masterKey);
    this.clearSensitiveData(newDerivedKey);
    this.clearSensitiveData(encrypted);
  }

  /**
   * Ensure directory structure exists with secure permissions
   */
  private ensureDirectoryStructure(): void {
    const directories = [this.configDir, this.keysDir, this.backupDir];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { mode: 0o700, recursive: true });
      } else {
        // Ensure secure permissions on existing directories
        fs.chmodSync(dir, 0o700);
      }
    }
  }

  /**
   * Encrypt data with the master key
   * 
   * @param data - Data to encrypt
   * @param masterKey - Master key for encryption
   * @returns Encrypted data structure
   */
  private async encryptWithMasterKey(
    data: Buffer,
    masterKey: Buffer
  ): Promise<{ encrypted: Buffer; iv: Buffer; tag: Buffer }> {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    return { encrypted, iv, tag };
  }

  /**
   * Decrypt data with the master key
   * 
   * @param encrypted - Encrypted data
   * @param iv - Initialization vector
   * @param tag - Authentication tag
   * @param masterKey - Master key for decryption
   * @returns Decrypted data buffer
   */
  private async decryptWithMasterKey(
    encrypted: Buffer,
    iv: Buffer,
    tag: Buffer,
    masterKey: Buffer
  ): Promise<Buffer> {
    const decipher = createDecipheriv(this.algorithm, masterKey, iv);
    decipher.setAuthTag(tag);
    
    try {
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch (error) {
      throw new Error('Failed to decrypt with master key: Invalid key or corrupted data');
    }
  }

  /**
   * Clear sensitive data from memory
   * 
   * @param buffer - Buffer to clear
   */
  private clearSensitiveData(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
      buffer.fill(0);
    }
  }
}