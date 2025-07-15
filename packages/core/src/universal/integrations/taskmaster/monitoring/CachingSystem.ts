/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Cache entry with enhanced metadata
 */
export interface EnhancedCacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: Date;
  expiresAt: Date;
  lastAccessed: Date;
  hits: number;
  size: number;
  tags: string[];
  priority: CachePriority;
  contentHash: string;
}

/**
 * Cache priority levels
 */
export type CachePriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Cache statistics
 */
export interface CacheStatistics {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  averageAccessTime: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  topKeys: Array<{ key: string; hits: number }>;
  sizeDistribution: Record<string, number>;
  priorityDistribution: Record<CachePriority, number>;
}

/**
 * Cache invalidation strategies
 */
export interface CacheInvalidationStrategy {
  name: string;
  shouldInvalidate(entry: EnhancedCacheEntry, context?: any): boolean;
  priority: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionThreshold: number;
  enableCompression: boolean;
  enableAnalytics: boolean;
  invalidationStrategies: CacheInvalidationStrategy[];
}

/**
 * Cache events
 */
export interface CacheEvents {
  'hit': { key: string; entry: EnhancedCacheEntry };
  'miss': { key: string };
  'set': { key: string; entry: EnhancedCacheEntry };
  'delete': { key: string; reason: string };
  'cleanup': { removedCount: number; reclaimedSize: number };
  'invalidation': { strategy: string; affectedKeys: string[] };
  'warning': { message: string; context?: any };
  'error': { error: Error; context?: any };
}

/**
 * Enhanced caching system with advanced features
 */
export class EnhancedCachingSystem extends EventEmitter {
  private cache = new Map<string, EnhancedCacheEntry>();
  private config: CacheConfig;
  private stats: CacheStatistics;
  private cleanupTimer?: NodeJS.Timeout;
  private accessTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 100 * 1024 * 1024, // 100MB
      maxEntries: config.maxEntries || 10000,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      compressionThreshold: config.compressionThreshold || 1024, // 1KB
      enableCompression: config.enableCompression ?? false,
      enableAnalytics: config.enableAnalytics ?? true,
      invalidationStrategies: config.invalidationStrategies || this.getDefaultInvalidationStrategies()
    };

    this.stats = this.initializeStats();
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.missCount++;
        this.emit('miss', { key });
        return null;
      }

      // Check if entry has expired
      if (Date.now() > entry.expiresAt.getTime()) {
        this.delete(key, 'expired');
        this.stats.missCount++;
        this.emit('miss', { key });
        return null;
      }

      // Update access statistics
      entry.lastAccessed = new Date();
      entry.hits++;
      this.stats.hitCount++;
      
      if (this.config.enableAnalytics) {
        this.accessTimes.push(Date.now() - startTime);
        if (this.accessTimes.length > 1000) {
          this.accessTimes = this.accessTimes.slice(-100);
        }
      }

      this.emit('hit', { key, entry });
      return this.deserializeValue(entry.value);
      
    } catch (error) {
      this.emit('error', { error: error as Error, context: { operation: 'get', key } });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      priority?: CachePriority;
    } = {}
  ): Promise<void> {
    try {
      const serializedValue = await this.serializeValue(value);
      const size = this.calculateSize(serializedValue);
      const ttl = options.ttl || this.config.defaultTTL;
      
      const entry: EnhancedCacheEntry = {
        key,
        value: serializedValue,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + ttl),
        lastAccessed: new Date(),
        hits: 0,
        size,
        tags: options.tags || [],
        priority: options.priority || 'medium',
        contentHash: this.generateContentHash(serializedValue)
      };

      // Check if we need to make space
      await this.ensureSpace(size);
      
      // Remove existing entry if it exists
      if (this.cache.has(key)) {
        this.delete(key, 'replaced');
      }

      this.cache.set(key, entry);
      this.updateStatsForSet(entry);
      
      this.emit('set', { key, entry });
      
    } catch (error) {
      this.emit('error', { error: error as Error, context: { operation: 'set', key } });
      throw error;
    }
  }

  /**
   * Delete entry from cache
   */
  delete(key: string, reason: string = 'manual'): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.updateStatsForDelete(entry);
    this.emit('delete', { key, reason });
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(reason: string = 'manual'): void {
    const keysToDelete = Array.from(this.cache.keys());
    this.cache.clear();
    this.stats = this.initializeStats();
    
    keysToDelete.forEach(key => {
      this.emit('delete', { key, reason });
    });
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        keysToDelete.push(key);
        invalidatedCount++;
      }
    }

    keysToDelete.forEach(key => this.delete(key, 'tag-invalidation'));
    
    if (invalidatedCount > 0) {
      this.emit('invalidation', { strategy: 'tags', affectedKeys: keysToDelete });
    }

    return invalidatedCount;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
        invalidatedCount++;
      }
    }

    keysToDelete.forEach(key => this.delete(key, 'pattern-invalidation'));
    
    if (invalidatedCount > 0) {
      this.emit('invalidation', { strategy: 'pattern', affectedKeys: keysToDelete });
    }

    return invalidatedCount;
  }

  /**
   * Apply invalidation strategies
   */
  applyInvalidationStrategies(context?: any): number {
    let totalInvalidated = 0;
    
    // Sort strategies by priority
    const strategies = [...this.config.invalidationStrategies].sort((a, b) => b.priority - a.priority);
    
    for (const strategy of strategies) {
      const keysToDelete: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (strategy.shouldInvalidate(entry, context)) {
          keysToDelete.push(key);
        }
      }
      
      if (keysToDelete.length > 0) {
        keysToDelete.forEach(key => this.delete(key, `strategy-${strategy.name}`));
        totalInvalidated += keysToDelete.length;
        
        this.emit('invalidation', { strategy: strategy.name, affectedKeys: keysToDelete });
      }
    }

    return totalInvalidated;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    this.updateDynamicStats();
    return { ...this.stats };
  }

  /**
   * Get cache health information
   */
  getHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
    metrics: CacheStatistics;
  } {
    const stats = this.getStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check hit rate
    if (stats.hitRate < 0.5) {
      issues.push('Low cache hit rate');
      recommendations.push('Consider adjusting TTL or cache keys');
      status = 'warning';
    }

    // Check memory usage
    const memoryUsagePercent = stats.totalSize / this.config.maxSize;
    if (memoryUsagePercent > 0.9) {
      issues.push('High memory usage');
      recommendations.push('Consider increasing cache size or implementing more aggressive cleanup');
      status = 'critical';
    } else if (memoryUsagePercent > 0.7) {
      issues.push('Moderate memory usage');
      recommendations.push('Monitor memory usage closely');
      if (status === 'healthy') status = 'warning';
    }

    // Check entry count
    const entryUsagePercent = stats.totalEntries / this.config.maxEntries;
    if (entryUsagePercent > 0.9) {
      issues.push('High entry count');
      recommendations.push('Consider increasing max entries or implementing LRU eviction');
      status = 'critical';
    }

    return { status, issues, recommendations, metrics: stats };
  }

  /**
   * Perform cleanup of expired and low-priority entries
   */
  cleanup(): { removedCount: number; reclaimedSize: number } {
    let removedCount = 0;
    let reclaimedSize = 0;
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        keysToDelete.push(key);
        reclaimedSize += entry.size;
        removedCount++;
      }
    }

    // If we're still over capacity, remove low-priority entries
    if (this.getCurrentSize() > this.config.maxSize * 0.8) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => {
          // Sort by priority (low first) then by last accessed (oldest first)
          const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
          
          if (priorityDiff !== 0) return priorityDiff;
          
          return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
        });

      const targetSize = this.config.maxSize * 0.7;
      let currentSize = this.getCurrentSize();

      for (const [key, entry] of entries) {
        if (currentSize <= targetSize) break;
        if (!keysToDelete.includes(key)) {
          keysToDelete.push(key);
          reclaimedSize += entry.size;
          removedCount++;
          currentSize -= entry.size;
        }
      }
    }

    // Remove the entries
    keysToDelete.forEach(key => this.delete(key, 'cleanup'));

    this.emit('cleanup', { removedCount, reclaimedSize });
    
    return { removedCount, reclaimedSize };
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear('destroy');
    this.removeAllListeners();
  }

  /**
   * Get default invalidation strategies
   */
  private getDefaultInvalidationStrategies(): CacheInvalidationStrategy[] {
    return [
      {
        name: 'expired',
        shouldInvalidate: (entry) => Date.now() > entry.expiresAt.getTime(),
        priority: 100
      },
      {
        name: 'low-priority-lru',
        shouldInvalidate: (entry) => {
          if (entry.priority !== 'low') return false;
          const ageThreshold = 10 * 60 * 1000; // 10 minutes
          return Date.now() - entry.lastAccessed.getTime() > ageThreshold;
        },
        priority: 50
      },
      {
        name: 'unused-entries',
        shouldInvalidate: (entry) => {
          return entry.hits === 0 && Date.now() - entry.timestamp.getTime() > 60000; // 1 minute
        },
        priority: 30
      }
    ];
  }

  /**
   * Serialize value for storage
   */
  private async serializeValue(value: any): Promise<string> {
    try {
      const serialized = JSON.stringify(value);
      
      if (this.config.enableCompression && serialized.length > this.config.compressionThreshold) {
        // In a real implementation, you would use compression here
        // For now, we'll just return the serialized value
        return serialized;
      }
      
      return serialized;
    } catch (error) {
      throw new Error(`Failed to serialize cache value: ${error}`);
    }
  }

  /**
   * Deserialize value from storage
   */
  private deserializeValue(value: string): any {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`Failed to deserialize cache value: ${error}`);
    }
  }

  /**
   * Calculate the size of a value in bytes
   */
  private calculateSize(value: string): number {
    return Buffer.byteLength(value, 'utf8');
  }

  /**
   * Generate content hash for cache validation
   */
  private generateContentHash(value: string): string {
    // Simple hash function for demo purposes
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get current total cache size
   */
  private getCurrentSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Ensure there's enough space for a new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    if (this.cache.size >= this.config.maxEntries) {
      this.cleanup();
    }

    const currentSize = this.getCurrentSize();
    if (currentSize + requiredSize > this.config.maxSize) {
      this.cleanup();
      
      // If still not enough space, remove entries until we have space
      const finalRequiredSpace = this.config.maxSize * 0.9; // Leave 10% buffer
      if (this.getCurrentSize() > finalRequiredSpace) {
        const entries = Array.from(this.cache.entries())
          .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

        for (const [key] of entries) {
          this.delete(key, 'space-reclamation');
          if (this.getCurrentSize() <= finalRequiredSpace) break;
        }
      }
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): CacheStatistics {
    return {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      averageAccessTime: 0,
      topKeys: [],
      sizeDistribution: {},
      priorityDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
    };
  }

  /**
   * Update statistics when setting an entry
   */
  private updateStatsForSet(entry: EnhancedCacheEntry): void {
    this.stats.totalEntries++;
    this.stats.totalSize += entry.size;
    this.stats.priorityDistribution[entry.priority]++;
  }

  /**
   * Update statistics when deleting an entry
   */
  private updateStatsForDelete(entry: EnhancedCacheEntry): void {
    this.stats.totalEntries--;
    this.stats.totalSize -= entry.size;
    this.stats.priorityDistribution[entry.priority]--;
  }

  /**
   * Update dynamic statistics
   */
  private updateDynamicStats(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
    
    if (this.accessTimes.length > 0) {
      this.stats.averageAccessTime = this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length;
    }

    // Update top keys
    const keyHits = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hits }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);
    
    this.stats.topKeys = keyHits;

    // Update timestamps
    const entries = Array.from(this.cache.values());
    if (entries.length > 0) {
      this.stats.oldestEntry = entries.reduce((oldest, entry) => 
        entry.timestamp < oldest ? entry.timestamp : oldest, entries[0].timestamp);
      this.stats.newestEntry = entries.reduce((newest, entry) => 
        entry.timestamp > newest ? entry.timestamp : newest, entries[0].timestamp);
    }
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
      this.applyInvalidationStrategies();
    }, this.config.cleanupInterval);
  }
}

// Type the EventEmitter properly
export interface EnhancedCachingSystem {
  on<K extends keyof CacheEvents>(event: K, listener: (data: CacheEvents[K]) => void): this;
  emit<K extends keyof CacheEvents>(event: K, data: CacheEvents[K]): boolean;
}