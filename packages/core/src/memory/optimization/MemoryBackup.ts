/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MemoryBackup } from './interfaces.js';
import { BackupConfig, MemoryOptimizationResult } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory backup
 */
export class DefaultMemoryBackup implements MemoryBackup {
  private memoryStore: MemoryStore;
  private config: BackupConfig;
  private backups = new Map<string, BackupRecord>();
  private autoBackupTimer?: NodeJS.Timeout;

  constructor(memoryStore: MemoryStore, config?: Partial<BackupConfig>) {
    this.memoryStore = memoryStore;
    this.config = {
      storagePath: './memory-backups',
      frequency: 24 * 60 * 60 * 1000, // 24 hours
      retainCount: 30,
      enableIncremental: true,
      enableCompression: true,
      enableEncryption: false,
      format: 'json',
      ...config
    };
  }

  /**
   * Configure backup settings
   */
  async configureBackup(config: BackupConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Ensure storage directory exists
    await this.ensureStorageDirectory();
    
    // Restart auto-backup if it was running
    if (this.autoBackupTimer) {
      await this.stopAutoBackup();
      await this.startAutoBackup();
    }
  }

  /**
   * Create manual backup
   */
  async createBackup(name?: string): Promise<{
    id: string;
    name: string;
    path: string;
    size: number;
    memoryCount: number;
    createdAt: Date;
  }> {
    try {
      const backupId = uuidv4();
      const backupName = name || `backup-${new Date().toISOString().split('T')[0]}-${backupId.slice(0, 8)}`;
      
      // Get all memories
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;
      
      // Create backup data
      const backupData = {
        id: backupId,
        name: backupName,
        type: 'manual' as const,
        createdAt: new Date(),
        format: this.config.format,
        memories,
        metadata: {
          memoryCount: memories.length,
          originalSize: this.calculateMemorySize(memories),
          version: '1.0.0'
        }
      };

      // Store backup
      const backupPath = await this.storeBackup(backupData);
      const backupSize = (await fs.stat(backupPath)).size;
      
      // Register backup
      const backupRecord: BackupRecord = {
        id: backupId,
        name: backupName,
        path: backupPath,
        size: backupSize,
        memoryCount: memories.length,
        createdAt: new Date()
      };
      
      this.backups.set(backupId, backupRecord);

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupRecord;

    } catch (error) {
      throw new Error(`Failed to create backup: ${(error as Error).message}`);
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, options?: {
    overwrite?: boolean;
    agentIds?: string[];
  }): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      // Load backup
      const backupData = await this.loadBackup(backupId);
      
      let memoriesToRestore = backupData.memories;
      if (options?.agentIds) {
        memoriesToRestore = memoriesToRestore.filter(memory => 
          options.agentIds!.includes(memory.agentId)
        );
      }

      // Check for conflicts if not overwriting
      let conflicts: string[] = [];
      if (!options?.overwrite) {
        for (const memory of memoriesToRestore) {
          try {
            const existing = await this.memoryStore.retrieve(memory.id);
            if (existing) {
              conflicts.push(memory.id);
            }
          } catch {
            // Memory doesn't exist, no conflict
          }
        }
      }

      // Restore memories
      let memoriesRestored = 0;
      for (const memory of memoriesToRestore) {
        if (!conflicts.includes(memory.id)) {
          await this.memoryStore.store(memory);
          memoriesRestored++;
        }
      }

      return {
        success: true,
        message: `Successfully restored ${memoriesRestored} memories from backup ${backupData.name}`,
        memoriesProcessed: memoriesToRestore.length,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: -memoriesRestored, // Negative because we're restoring
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: this.calculateMemorySize(memoriesToRestore)
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to restore from backup: ${(error as Error).message}`,
        memoriesProcessed: 0,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived: 0,
        duration: Date.now() - startTime,
        memoryUsageBefore: 0,
        memoryUsageAfter: 0,
        error: error as Error
      };
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    memoryCount: number;
    createdAt: Date;
  }>> {
    await this.loadBackupRegistry();
    return Array.from(this.backups.values());
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        throw new Error(`Backup ${backupId} not found`);
      }

      await fs.unlink(backup.path);
      this.backups.delete(backupId);
    } catch (error) {
      throw new Error(`Failed to delete backup: ${(error as Error).message}`);
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    issues: string[];
    checkedAt: Date;
  }> {
    const issues: string[] = [];
    const checkedAt = new Date();
    
    try {
      const backup = this.backups.get(backupId);
      if (!backup) {
        issues.push('Backup record not found');
        return { valid: false, issues, checkedAt };
      }

      // Check if backup file exists
      try {
        await fs.access(backup.path);
      } catch {
        issues.push('Backup file not found');
        return { valid: false, issues, checkedAt };
      }

      // Load and validate backup data
      const backupData = await this.loadBackup(backupId);
      
      // Validate structure
      if (!backupData.memories || !Array.isArray(backupData.memories)) {
        issues.push('Invalid backup structure: memories array missing');
      }

      // Validate memory count
      if (backupData.memories.length !== backup.memoryCount) {
        issues.push(`Memory count mismatch: expected ${backup.memoryCount}, found ${backupData.memories.length}`);
      }

      // Validate individual memories
      for (let i = 0; i < Math.min(backupData.memories.length, 100); i++) {
        const memory = backupData.memories[i];
        if (!memory.id || !memory.type || !memory.agentId) {
          issues.push(`Invalid memory structure at index ${i}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        checkedAt
      };

    } catch (error) {
      issues.push(`Verification failed: ${(error as Error).message}`);
      return { valid: false, issues, checkedAt };
    }
  }

  /**
   * Start automatic backup
   */
  async startAutoBackup(): Promise<void> {
    if (this.autoBackupTimer) {
      return;
    }

    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        console.error('Auto-backup failed:', error);
      }
    }, this.config.frequency);
  }

  /**
   * Stop automatic backup
   */
  async stopAutoBackup(): Promise<void> {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = undefined;
    }
  }

  /**
   * Store backup to disk
   */
  private async storeBackup(backupData: BackupData): Promise<string> {
    await this.ensureStorageDirectory();
    
    const backupPath = this.getBackupPath(backupData.id);
    let dataToStore = JSON.stringify(backupData, null, 2);
    
    if (this.config.enableCompression) {
      dataToStore = await this.compressData(dataToStore);
    }
    
    if (this.config.enableEncryption) {
      dataToStore = await this.encryptData(dataToStore);
    }
    
    await fs.writeFile(backupPath, dataToStore);
    return backupPath;
  }

  /**
   * Load backup from disk
   */
  private async loadBackup(backupId: string): Promise<BackupData> {
    const backupPath = this.getBackupPath(backupId);
    let data = await fs.readFile(backupPath, 'utf-8');
    
    if (this.config.enableEncryption) {
      data = await this.decryptData(data);
    }
    
    if (this.config.enableCompression) {
      data = await this.decompressData(data);
    }
    
    return JSON.parse(data);
  }

  /**
   * Load backup registry
   */
  private async loadBackupRegistry(): Promise<void> {
    try {
      await this.ensureStorageDirectory();
      const files = await fs.readdir(this.config.storagePath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const backupId = file.replace('.json', '');
          if (!this.backups.has(backupId)) {
            try {
              const backupPath = join(this.config.storagePath, file);
              const backupData = await this.loadBackup(backupId);
              const stats = await fs.stat(backupPath);
              
              this.backups.set(backupId, {
                id: backupId,
                name: backupData.name,
                path: backupPath,
                size: stats.size,
                memoryCount: backupData.memories.length,
                createdAt: backupData.createdAt
              });
            } catch (error) {
              console.warn(`Failed to load backup ${backupId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load backup registry:', error);
    }
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    const backupList = Array.from(this.backups.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (backupList.length > this.config.retainCount) {
      const backupsToDelete = backupList.slice(this.config.retainCount);
      
      for (const backup of backupsToDelete) {
        try {
          await this.deleteBackup(backup.id);
        } catch (error) {
          console.warn(`Failed to delete old backup ${backup.id}:`, error);
        }
      }
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.storagePath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create storage directory: ${(error as Error).message}`);
    }
  }

  /**
   * Get backup file path
   */
  private getBackupPath(backupId: string): string {
    return join(this.config.storagePath, `${backupId}.json`);
  }

  /**
   * Calculate memory size in bytes
   */
  private calculateMemorySize(memories: MemoryItem[]): number {
    return memories.reduce((total, memory) => {
      return total + JSON.stringify(memory).length;
    }, 0);
  }

  /**
   * Compress data (placeholder implementation)
   */
  private async compressData(data: string): Promise<string> {
    // In a real implementation, use gzip or similar
    return data;
  }

  /**
   * Decompress data (placeholder implementation)
   */
  private async decompressData(data: string): Promise<string> {
    // In a real implementation, use gzip or similar
    return data;
  }

  /**
   * Encrypt data (placeholder implementation)
   */
  private async encryptData(data: string): Promise<string> {
    // In a real implementation, use proper encryption
    return data;
  }

  /**
   * Decrypt data (placeholder implementation)
   */
  private async decryptData(data: string): Promise<string> {
    // In a real implementation, use proper decryption
    return data;
  }
}

/**
 * Backup record interface
 */
interface BackupRecord {
  id: string;
  name: string;
  path: string;
  size: number;
  memoryCount: number;
  createdAt: Date;
}

/**
 * Backup data interface
 */
interface BackupData {
  id: string;
  name: string;
  type: 'manual' | 'automatic';
  createdAt: Date;
  format: string;
  memories: MemoryItem[];
  metadata: {
    memoryCount: number;
    originalSize: number;
    version: string;
  };
}