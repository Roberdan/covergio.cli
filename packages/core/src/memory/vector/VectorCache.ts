/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { VectorCache } from './interfaces.js';
import { VectorEmbedding } from './types.js';

/**
 * LRU cache entry for vector storage
 */
interface CacheEntry {
  vector: VectorEmbedding;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl?: number;
}

/**
 * In-memory LRU cache implementation for vector embeddings
 */
export class InMemoryVectorCache implements VectorCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTtl: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(maxSize: number = 1000, defaultTtl: number = 3600000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
    
    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Get cached vector by ID
   */
  async get(vectorId: string): Promise<VectorEmbedding | null> {
    const entry = this.cache.get(vectorId);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(vectorId);
      this.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.hits++;

    // Move to end (most recently used)
    this.cache.delete(vectorId);
    this.cache.set(vectorId, entry);

    return entry.vector;
  }

  /**
   * Cache a vector
   */
  async set(vectorId: string, vector: VectorEmbedding, ttl?: number): Promise<void> {
    const now = Date.now();
    
    // If already exists, update it
    if (this.cache.has(vectorId)) {
      const existing = this.cache.get(vectorId)!;
      existing.vector = vector;
      existing.lastAccessed = now;
      existing.accessCount++;
      existing.ttl = ttl;
      
      // Move to end
      this.cache.delete(vectorId);
      this.cache.set(vectorId, existing);
      return;
    }

    // Check if cache is full
    if (this.cache.size >= this.maxSize) {
      await this.evictLeastRecentlyUsed();
    }

    // Add new entry
    const entry: CacheEntry = {
      vector,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      ttl: ttl || this.defaultTtl
    };

    this.cache.set(vectorId, entry);
  }

  /**
   * Delete cached vector
   */
  async delete(vectorId: string): Promise<void> {
    this.cache.delete(vectorId);
  }

  /**
   * Check if vector is cached
   */
  async has(vectorId: string): Promise<boolean> {
    const entry = this.cache.get(vectorId);
    
    if (!entry) {
      return false;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(vectorId);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached vectors
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  }> {
    const totalRequests = this.hits + this.misses;
    
    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      evictions: this.evictions
    };
  }

  /**
   * Get detailed cache information
   */
  async getDetailedStats(): Promise<{
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
    missRate: number;
    averageAccessCount: number;
    oldestEntry: number;
    newestEntry: number;
    memoryUsage: number;
  }> {
    const totalRequests = this.hits + this.misses;
    let totalAccessCount = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let memoryUsage = 0;

    this.cache.forEach(entry => {
      totalAccessCount += entry.accessCount;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
      
      // Rough memory usage calculation (vector dimensions * 8 bytes per float)
      memoryUsage += entry.vector.dimensions * 8 + 200; // +200 for metadata overhead
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      averageAccessCount: this.cache.size > 0 ? totalAccessCount / this.cache.size : 0,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
      memoryUsage
    };
  }

  /**
   * Evict least recently used item
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.cache.size === 0) {
      return;
    }

    // Find LRU item (first item in Map is least recently used due to our access pattern)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.evictions++;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.ttl) {
      return false;
    }
    
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
  }

  /**
   * Get cache entries sorted by access frequency
   */
  async getMostAccessed(limit: number = 10): Promise<Array<{
    id: string;
    vector: VectorEmbedding;
    accessCount: number;
    lastAccessed: number;
  }>> {
    const entries: Array<{
      id: string;
      vector: VectorEmbedding;
      accessCount: number;
      lastAccessed: number;
    }> = [];

    this.cache.forEach((entry, id) => {
      entries.push({
        id,
        vector: entry.vector,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      });
    });

    // Sort by access count (descending)
    entries.sort((a, b) => b.accessCount - a.accessCount);
    
    return entries.slice(0, limit);
  }

  /**
   * Get recently added cache entries
   */
  async getRecentlyAdded(limit: number = 10): Promise<Array<{
    id: string;
    vector: VectorEmbedding;
    timestamp: number;
  }>> {
    const entries: Array<{
      id: string;
      vector: VectorEmbedding;
      timestamp: number;
    }> = [];

    this.cache.forEach((entry, id) => {
      entries.push({
        id,
        vector: entry.vector,
        timestamp: entry.timestamp
      });
    });

    // Sort by timestamp (descending)
    entries.sort((a, b) => b.timestamp - a.timestamp);
    
    return entries.slice(0, limit);
  }

  /**
   * Resize cache (adjust max size)
   */
  async resize(newMaxSize: number): Promise<void> {
    this.maxSize = newMaxSize;
    
    // If new size is smaller, evict oldest entries
    while (this.cache.size > this.maxSize) {
      await this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Update TTL for cached vector
   */
  async updateTtl(vectorId: string, newTtl: number): Promise<boolean> {
    const entry = this.cache.get(vectorId);
    
    if (!entry) {
      return false;
    }

    entry.ttl = newTtl;
    return true;
  }

  /**
   * Get vectors by pattern matching on IDs
   */
  async getByPattern(pattern: RegExp): Promise<Array<{
    id: string;
    vector: VectorEmbedding;
  }>> {
    const results: Array<{
      id: string;
      vector: VectorEmbedding;
    }> = [];

    this.cache.forEach((entry, id) => {
      if (pattern.test(id) && !this.isExpired(entry)) {
        // Update access statistics
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        
        results.push({
          id,
          vector: entry.vector
        });
      }
    });

    return results;
  }

  /**
   * Preload vectors into cache
   */
  async preload(vectors: Array<{ id: string; vector: VectorEmbedding }>): Promise<number> {
    let loaded = 0;
    
    for (const item of vectors) {
      if (this.cache.size < this.maxSize) {
        await this.set(item.id, item.vector);
        loaded++;
      } else {
        break;
      }
    }
    
    return loaded;
  }

  /**
   * Export cache contents
   */
  async export(): Promise<Array<{
    id: string;
    vector: VectorEmbedding;
    metadata: {
      timestamp: number;
      accessCount: number;
      lastAccessed: number;
      ttl?: number;
    };
  }>> {
    const exported: Array<{
      id: string;
      vector: VectorEmbedding;
      metadata: {
        timestamp: number;
        accessCount: number;
        lastAccessed: number;
        ttl?: number;
      };
    }> = [];

    this.cache.forEach((entry, id) => {
      if (!this.isExpired(entry)) {
        exported.push({
          id,
          vector: entry.vector,
          metadata: {
            timestamp: entry.timestamp,
            accessCount: entry.accessCount,
            lastAccessed: entry.lastAccessed,
            ttl: entry.ttl
          }
        });
      }
    });

    return exported;
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }
}