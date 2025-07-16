/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Cache entry interface with TTL and metadata
 */
export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  size: number;
  tags: string[];
  metadata?: Record<string, any>;
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  checkInterval: number;
  enableCompression: boolean;
  enableMetrics: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    database?: number;
    keyPrefix?: string;
  };
}

/**
 * Cache metrics interface
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  memoryUsage: number;
  hitRate: number;
  operations: {
    gets: number;
    sets: number;
    deletes: number;
    invalidations: number;
  };
  performance: {
    avgGetTime: number;
    avgSetTime: number;
    avgDeleteTime: number;
  };
}

/**
 * Cache invalidation options
 */
export interface InvalidationOptions {
  tags?: string[];
  pattern?: string;
  beforeTimestamp?: number;
  force?: boolean;
}

/**
 * Universal Cache Manager with Redis support and advanced features
 */
export class CacheManager extends EventEmitter {
  private memoryCache = new Map<string, CacheEntry>();
  private redisClient: any = null;
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private compressionEnabled = false;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      maxSize: 1000,
      defaultTtl: 300000, // 5 minutes
      checkInterval: 60000, // 1 minute
      enableCompression: false,
      enableMetrics: true,
      evictionPolicy: 'lru',
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      size: 0,
      memoryUsage: 0,
      hitRate: 0,
      operations: {
        gets: 0,
        sets: 0,
        deletes: 0,
        invalidations: 0
      },
      performance: {
        avgGetTime: 0,
        avgSetTime: 0,
        avgDeleteTime: 0
      }
    };

    this.initialize();
  }

  /**
   * Initialize the cache manager
   */
  private async initialize(): Promise<void> {
    // Initialize Redis if configured
    if (this.config.redisConfig) {
      await this.initializeRedis();
    }

    // Setup compression if enabled
    if (this.config.enableCompression) {
      this.setupCompression();
    }

    // Start cleanup interval
    this.startCleanupInterval();

    this.emit('initialized', { config: this.config });
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Dynamic import to avoid bundling Redis if not needed
      const { createClient } = await import('redis');
      
      this.redisClient = createClient({
        socket: {
          host: this.config.redisConfig!.host,
          port: this.config.redisConfig!.port
        },
        password: this.config.redisConfig!.password,
        database: this.config.redisConfig!.database || 0
      });

      await this.redisClient.connect();
      this.emit('redis-connected');
    } catch (error) {
      console.warn('Redis initialization failed, falling back to memory cache:', error);
      this.redisClient = null;
    }
  }

  /**
   * Setup compression for large values
   */
  private setupCompression(): void {
    try {
      // Try to load compression library
      require('zlib');
      this.compressionEnabled = true;
    } catch (error) {
      console.warn('Compression not available, disabled');
      this.compressionEnabled = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();
    this.metrics.operations.gets++;

    try {
      let entry: CacheEntry<T> | null = null;

      // Try Redis first if available
      if (this.redisClient) {
        entry = await this.getFromRedis<T>(key);
      }

      // Fallback to memory cache
      if (!entry) {
        entry = this.getFromMemory<T>(key);
      }

      // Update metrics and return
      const endTime = performance.now();
      this.updatePerformanceMetrics('get', endTime - startTime);

      if (entry) {
        // Check TTL
        if (this.isExpired(entry)) {
          await this.delete(key);
          this.metrics.misses++;
          return null;
        }

        // Update hit statistics
        entry.hits++;
        entry.lastAccessed = Date.now();
        this.metrics.hits++;
        
        return entry.value;
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      this.emit('error', { operation: 'get', key, error });
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const startTime = performance.now();
    this.metrics.operations.sets++;

    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: options.ttl || this.config.defaultTtl,
        hits: 0,
        lastAccessed: Date.now(),
        size: this.calculateSize(value),
        tags: options.tags || [],
        metadata: options.metadata
      };

      // Store in Redis if available
      if (this.redisClient) {
        await this.setInRedis(key, entry);
      }

      // Store in memory cache
      await this.setInMemory(key, entry);

      // Update metrics
      const endTime = performance.now();
      this.updatePerformanceMetrics('set', endTime - startTime);

      this.emit('set', { key, size: entry.size, ttl: entry.ttl });
    } catch (error) {
      this.emit('error', { operation: 'set', key, error });
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const startTime = performance.now();
    this.metrics.operations.deletes++;

    try {
      let deleted = false;

      // Delete from Redis
      if (this.redisClient) {
        const redisDeleted = await this.redisClient.del(this.getRedisKey(key));
        deleted = redisDeleted > 0;
      }

      // Delete from memory
      const memoryDeleted = this.memoryCache.delete(key);
      deleted = deleted || memoryDeleted;

      // Update metrics
      if (deleted) {
        this.metrics.size = Math.max(0, this.metrics.size - 1);
      }

      const endTime = performance.now();
      this.updatePerformanceMetrics('delete', endTime - startTime);

      if (deleted) {
        this.emit('delete', { key });
      }

      return deleted;
    } catch (error) {
      this.emit('error', { operation: 'delete', key, error });
      return false;
    }
  }

  /**
   * Invalidate cache entries by criteria
   */
  async invalidate(options: InvalidationOptions): Promise<number> {
    this.metrics.operations.invalidations++;
    let invalidated = 0;

    try {
      const keysToDelete: string[] = [];

      // Collect keys from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (this.shouldInvalidateEntry(entry, options)) {
          keysToDelete.push(key);
        }
      }

      // Delete collected keys
      for (const key of keysToDelete) {
        if (await this.delete(key)) {
          invalidated++;
        }
      }

      // Handle Redis invalidation if pattern is provided
      if (this.redisClient && options.pattern) {
        const redisKeys = await this.redisClient.keys(`${this.config.redisConfig!.keyPrefix || ''}${options.pattern}`);
        for (const redisKey of redisKeys) {
          if (await this.redisClient.del(redisKey)) {
            invalidated++;
          }
        }
      }

      this.emit('invalidate', { invalidated, options });
      return invalidated;
    } catch (error) {
      this.emit('error', { operation: 'invalidate', options, error });
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      // Clear Redis
      if (this.redisClient) {
        if (this.config.redisConfig!.keyPrefix) {
          const keys = await this.redisClient.keys(`${this.config.redisConfig!.keyPrefix}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        } else {
          await this.redisClient.flushDb();
        }
      }

      // Clear memory cache
      this.memoryCache.clear();

      // Reset metrics
      this.metrics.size = 0;
      this.metrics.memoryUsage = 0;

      this.emit('clear');
    } catch (error) {
      this.emit('error', { operation: 'clear', error });
      throw error;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    // Update hit rate
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0;

    // Update memory usage
    this.metrics.memoryUsage = this.calculateMemoryUsage();
    this.metrics.size = this.memoryCache.size;

    return { ...this.metrics };
  }

  /**
   * Get cache health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    redis: boolean;
    memory: {
      usage: number;
      maxSize: number;
      utilizationPercent: number;
    };
    performance: {
      hitRate: number;
      avgResponseTime: number;
    };
  }> {
    const metrics = this.getMetrics();
    const memoryUtilization = (this.memoryCache.size / this.config.maxSize) * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (memoryUtilization > 90 || metrics.hitRate < 0.5) {
      status = 'degraded';
    }
    
    if (memoryUtilization > 95 || metrics.hitRate < 0.2) {
      status = 'unhealthy';
    }

    return {
      status,
      redis: !!this.redisClient,
      memory: {
        usage: this.memoryCache.size,
        maxSize: this.config.maxSize,
        utilizationPercent: memoryUtilization
      },
      performance: {
        hitRate: metrics.hitRate,
        avgResponseTime: (metrics.performance.avgGetTime + metrics.performance.avgSetTime) / 2
      }
    };
  }

  /**
   * Helper methods
   */
  private getFromMemory<T>(key: string): CacheEntry<T> | null {
    return this.memoryCache.get(key) || null;
  }

  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const data = await this.redisClient.get(this.getRedisKey(key));
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  private async setInMemory<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Check size limits and evict if necessary
    if (this.memoryCache.size >= this.config.maxSize) {
      await this.evictEntries();
    }

    this.memoryCache.set(key, entry);
    this.metrics.size++;
  }

  private async setInRedis<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const ttlSeconds = Math.ceil(entry.ttl / 1000);
    await this.redisClient.setEx(
      this.getRedisKey(key),
      ttlSeconds,
      JSON.stringify(entry)
    );
  }

  private getRedisKey(key: string): string {
    const prefix = this.config.redisConfig?.keyPrefix || 'convergio:cache:';
    return `${prefix}${key}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > (entry.timestamp + entry.ttl);
  }

  private shouldInvalidateEntry(entry: CacheEntry, options: InvalidationOptions): boolean {
    if (options.tags && options.tags.length > 0) {
      if (!entry.tags.some(tag => options.tags!.includes(tag))) {
        return false;
      }
    }

    if (options.beforeTimestamp && entry.timestamp >= options.beforeTimestamp) {
      return false;
    }

    return true;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  private calculateMemoryUsage(): number {
    let usage = 0;
    for (const entry of this.memoryCache.values()) {
      usage += entry.size || 0;
    }
    return usage;
  }

  private async evictEntries(): Promise<void> {
    const entriesToEvict = Math.ceil(this.config.maxSize * 0.1); // Evict 10%
    const entries = Array.from(this.memoryCache.entries());

    // Sort by eviction policy
    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        break;
      case 'lfu':
        entries.sort(([, a], [, b]) => a.hits - b.hits);
        break;
      case 'ttl':
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
        break;
      case 'fifo':
      default:
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
        break;
    }

    // Evict entries
    for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
      await this.delete(entries[i][0]);
    }
  }

  private updatePerformanceMetrics(operation: 'get' | 'set' | 'delete', duration: number): void {
    const key = `avg${operation.charAt(0).toUpperCase() + operation.slice(1)}Time` as keyof typeof this.metrics.performance;
    const current = this.metrics.performance[key];
    this.metrics.performance[key] = current === 0 ? duration : (current + duration) / 2;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.config.checkInterval);
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      await this.delete(key);
    }

    this.emit('cleanup', { 
      removed: expiredKeys.length,
      totalSize: this.memoryCache.size
    });
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.memoryCache.clear();
    this.emit('destroyed');
  }
}