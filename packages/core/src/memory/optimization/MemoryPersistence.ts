/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { MemoryPersistence } from './interfaces.js';
import { ArchivingConfig, MemoryOptimizationResult, PruningCriteria } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory persistence
 */
export class DefaultMemoryPersistence implements MemoryPersistence {
  private memoryStore: MemoryStore;
  private config: ArchivingConfig;
  private archives = new Map<string, ArchiveRecord>();

  constructor(memoryStore: MemoryStore, config?: Partial<ArchivingConfig>) {
    this.memoryStore = memoryStore;
    this.config = {
      storagePath: './memory-archives',
      enableCompression: true,
      enableEncryption: false,
      format: 'json',
      retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
      enableAutoArchive: true,
      batchSize: 1000,
      ...config
    };
  }

  /**
   * Configure archiving settings
   */
  async configureArchiving(config: ArchivingConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Ensure storage directory exists
    await this.ensureStorageDirectory();
  }

  /**
   * Archive memories based on criteria
   */
  async archiveMemories(criteria: PruningCriteria): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      // Find memories to archive
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;
      const memoriesToArchive = memories.filter(memory => this.shouldArchiveMemory(memory, criteria));

      if (memoriesToArchive.length === 0) {
        return {
          success: true,
          message: 'No memories found matching archiving criteria',
          memoriesProcessed: memories.length,
          memoriesPruned: 0,
          memoriesConsolidated: 0,
          memoriesArchived: 0,
          duration: Date.now() - startTime,
          memoryUsageBefore: 0,
          memoryUsageAfter: 0
        };
      }

      // Create archive
      const archiveId = uuidv4();
      const archiveName = `archive-${new Date().toISOString().split('T')[0]}-${archiveId.slice(0, 8)}`;
      
      const archiveData = {
        id: archiveId,
        name: archiveName,
        memories: memoriesToArchive,
        metadata: {
          createdAt: new Date(),
          criteria,
          memoryCount: memoriesToArchive.length,
          originalSize: this.calculateMemorySize(memoriesToArchive)
        }
      };

      // Store archive
      await this.storeArchive(archiveData);

      // Remove archived memories from main store
      let memoriesArchived = 0;
      for (const memory of memoriesToArchive) {
        await this.memoryStore.delete(memory.id);
        memoriesArchived++;
      }

      // Register archive
      this.archives.set(archiveId, {
        id: archiveId,
        name: archiveName,
        memoryCount: memoriesToArchive.length,
        size: archiveData.metadata.originalSize,
        createdAt: new Date(),
        path: this.getArchivePath(archiveId)
      });

      return {
        success: true,
        message: `Successfully archived ${memoriesArchived} memories to ${archiveName}`,
        memoriesProcessed: memories.length,
        memoriesPruned: 0,
        memoriesConsolidated: 0,
        memoriesArchived,
        duration: Date.now() - startTime,
        memoryUsageBefore: this.calculateMemorySize(memories),
        memoryUsageAfter: this.calculateMemorySize(memories.filter(m => !memoriesToArchive.includes(m)))
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to archive memories: ${(error as Error).message}`,
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
   * Restore memories from archive
   */
  async restoreMemories(archiveId: string, memoryIds?: string[]): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    
    try {
      // Load archive
      const archiveData = await this.loadArchive(archiveId);
      
      let memoriesToRestore = archiveData.memories;
      if (memoryIds) {
        memoriesToRestore = memoriesToRestore.filter(memory => memoryIds.includes(memory.id));
      }

      // Restore memories to main store
      let memoriesRestored = 0;
      for (const memory of memoriesToRestore) {
        await this.memoryStore.store(memory);
        memoriesRestored++;
      }

      return {
        success: true,
        message: `Successfully restored ${memoriesRestored} memories from archive ${archiveData.name}`,
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
        message: `Failed to restore memories from archive: ${(error as Error).message}`,
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
   * List archived memories
   */
  async listArchives(): Promise<Array<{
    id: string;
    name: string;
    memoryCount: number;
    size: number;
    createdAt: Date;
  }>> {
    await this.loadArchiveRegistry();
    return Array.from(this.archives.values());
  }

  /**
   * Delete archive
   */
  async deleteArchive(archiveId: string): Promise<void> {
    try {
      const archivePath = this.getArchivePath(archiveId);
      await fs.unlink(archivePath);
      this.archives.delete(archiveId);
    } catch (error) {
      throw new Error(`Failed to delete archive: ${(error as Error).message}`);
    }
  }

  /**
   * Get archive details
   */
  async getArchiveDetails(archiveId: string): Promise<{
    id: string;
    name: string;
    memories: MemoryItem[];
    metadata: any;
    createdAt: Date;
  }> {
    try {
      const archiveData = await this.loadArchive(archiveId);
      return {
        id: archiveData.id,
        name: archiveData.name,
        memories: archiveData.memories,
        metadata: archiveData.metadata,
        createdAt: archiveData.metadata.createdAt
      };
    } catch (error) {
      throw new Error(`Failed to get archive details: ${(error as Error).message}`);
    }
  }

  /**
   * Check if memory should be archived
   */
  private shouldArchiveMemory(memory: MemoryItem, criteria: PruningCriteria): boolean {
    const now = Date.now();
    
    if (criteria.excludeTypes && criteria.excludeTypes.includes(memory.type)) {
      return false;
    }

    if (criteria.excludeAgents && criteria.excludeAgents.includes(memory.agentId)) {
      return false;
    }

    if (criteria.maxAge) {
      const age = now - (memory.metadata?.createdAt as Date)?.getTime();
      if (age > criteria.maxAge) {
        return true;
      }
    }

    if (criteria.minAccessCount && (memory.metadata?.accessCount || 0) < criteria.minAccessCount) {
      return true;
    }

    if (criteria.maxLastAccessedTime) {
      const lastAccessed = (memory.metadata?.lastAccessedAt as Date)?.getTime() || 0;
      if (lastAccessed < criteria.maxLastAccessedTime) {
        return true;
      }
    }

    if (criteria.minRelevanceScore && (memory.metadata?.importance || 0) < criteria.minRelevanceScore) {
      return true;
    }

    if (criteria.customFilter && criteria.customFilter(memory)) {
      return true;
    }

    return false;
  }

  /**
   * Store archive to disk
   */
  private async storeArchive(archiveData: ArchiveData): Promise<void> {
    await this.ensureStorageDirectory();
    
    const archivePath = this.getArchivePath(archiveData.id);
    let dataToStore = JSON.stringify(archiveData, null, 2);
    
    if (this.config.enableCompression) {
      dataToStore = await this.compressData(dataToStore);
    }
    
    if (this.config.enableEncryption) {
      dataToStore = await this.encryptData(dataToStore);
    }
    
    await fs.writeFile(archivePath, dataToStore);
  }

  /**
   * Load archive from disk
   */
  private async loadArchive(archiveId: string): Promise<ArchiveData> {
    const archivePath = this.getArchivePath(archiveId);
    let data = await fs.readFile(archivePath, 'utf-8');
    
    if (this.config.enableEncryption) {
      data = await this.decryptData(data);
    }
    
    if (this.config.enableCompression) {
      data = await this.decompressData(data);
    }
    
    return JSON.parse(data);
  }

  /**
   * Load archive registry
   */
  private async loadArchiveRegistry(): Promise<void> {
    try {
      await this.ensureStorageDirectory();
      const files = await fs.readdir(this.config.storagePath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const archiveId = file.replace('.json', '');
          if (!this.archives.has(archiveId)) {
            try {
              const archiveData = await this.loadArchive(archiveId);
              this.archives.set(archiveId, {
                id: archiveId,
                name: archiveData.name,
                memoryCount: archiveData.memories.length,
                size: archiveData.metadata.originalSize,
                createdAt: archiveData.metadata.createdAt,
                path: this.getArchivePath(archiveId)
              });
            } catch (error) {
              console.warn(`Failed to load archive ${archiveId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load archive registry:', error);
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
   * Get archive file path
   */
  private getArchivePath(archiveId: string): string {
    return join(this.config.storagePath, `${archiveId}.json`);
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
 * Archive record interface
 */
interface ArchiveRecord {
  id: string;
  name: string;
  memoryCount: number;
  size: number;
  createdAt: Date;
  path: string;
}

/**
 * Archive data interface
 */
interface ArchiveData {
  id: string;
  name: string;
  memories: MemoryItem[];
  metadata: {
    createdAt: Date;
    criteria: PruningCriteria;
    memoryCount: number;
    originalSize: number;
  };
}