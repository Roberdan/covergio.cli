/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * Memory usage snapshot interface
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  heapUtilization: number;
  memoryLeakSuspicion: number;
  gcActivity: {
    collections: number;
    duration: number;
    freed: number;
  };
}

/**
 * Memory profile analysis interface
 */
export interface MemoryProfile {
  duration: number;
  snapshots: MemorySnapshot[];
  statistics: {
    avgHeapUsed: number;
    maxHeapUsed: number;
    minHeapUsed: number;
    avgHeapUtilization: number;
    maxHeapUtilization: number;
    growthRate: number;
    leakDetected: boolean;
    gcEfficiency: number;
  };
  recommendations: string[];
  warnings: string[];
}

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  maxHeapSize: number;
  maxRss: number;
  heapUtilizationThreshold: number;
  gcFrequencyThreshold: number;
  memoryLeakThreshold: number;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

/**
 * Object pool statistics
 */
export interface PoolStatistics {
  totalCreated: number;
  totalReused: number;
  currentPoolSize: number;
  maxPoolSize: number;
  reuseRate: number;
  memoryFootprint: number;
}

/**
 * Advanced Memory Profiler and Resource Manager
 */
export class MemoryProfiler extends EventEmitter {
  private snapshots: MemorySnapshot[] = [];
  private profilingInterval?: NodeJS.Timeout;
  private gcObserver?: any;
  private config: ResourceLimits;
  private objectPools = new Map<string, ObjectPool>();
  private startTime: number = 0;
  private lastGcStats = { collections: 0, duration: 0, freed: 0 };

  constructor(config: Partial<ResourceLimits> = {}) {
    super();

    this.config = {
      maxHeapSize: 512 * 1024 * 1024, // 512MB
      maxRss: 1024 * 1024 * 1024, // 1GB
      heapUtilizationThreshold: 0.8, // 80%
      gcFrequencyThreshold: 10, // GC runs per minute
      memoryLeakThreshold: 0.05, // 5% growth per minute
      alertThresholds: {
        warning: 0.7, // 70% of limits
        critical: 0.9  // 90% of limits
      },
      ...config
    };

    this.setupGCObserver();
  }

  /**
   * Start memory profiling
   */
  startProfiling(intervalMs: number = 5000): void {
    if (this.profilingInterval) {
      this.stopProfiling();
    }

    this.startTime = Date.now();
    this.snapshots = [];

    // Take initial snapshot
    this.takeSnapshot();

    // Setup interval for regular snapshots
    this.profilingInterval = setInterval(() => {
      this.takeSnapshot();
      this.analyzeMemoryTrends();
    }, intervalMs);

    this.emit('profiling-started', { interval: intervalMs });
  }

  /**
   * Stop memory profiling
   */
  stopProfiling(): MemoryProfile {
    if (this.profilingInterval) {
      clearInterval(this.profilingInterval);
      this.profilingInterval = undefined;
    }

    const profile = this.generateProfile();
    this.emit('profiling-stopped', { profile });
    
    return profile;
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const timestamp = Date.now();

    const snapshot: MemorySnapshot = {
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
      memoryLeakSuspicion: this.calculateLeakSuspicion(),
      gcActivity: { ...this.lastGcStats }
    };

    this.snapshots.push(snapshot);

    // Keep only last 1000 snapshots to prevent memory issues
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }

    // Check thresholds
    this.checkMemoryThresholds(snapshot);

    return snapshot;
  }

  /**
   * Calculate memory leak suspicion score
   */
  private calculateLeakSuspicion(): number {
    if (this.snapshots.length < 10) return 0;

    const recent = this.snapshots.slice(-10);
    const older = this.snapshots.slice(-20, -10);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;

    const growthRate = (recentAvg - olderAvg) / olderAvg;
    return Math.max(0, Math.min(1, growthRate * 10)); // Scale to 0-1
  }

  /**
   * Analyze memory trends and detect issues
   */
  private analyzeMemoryTrends(): void {
    if (this.snapshots.length < 5) return;

    const latest = this.snapshots[this.snapshots.length - 1];
    const trends = this.calculateTrends();

    // Detect potential memory leak
    if (trends.growthRate > this.config.memoryLeakThreshold) {
      this.emit('memory-leak-detected', {
        growthRate: trends.growthRate,
        currentUsage: latest.heapUsed,
        trend: trends
      });
    }

    // Check GC efficiency
    if (trends.gcEfficiency < 0.5) {
      this.emit('gc-inefficiency-detected', {
        efficiency: trends.gcEfficiency,
        recommendations: [
          'Consider manual garbage collection',
          'Review object lifecycle management',
          'Optimize large object usage'
        ]
      });
    }

    // High memory pressure
    if (latest.heapUtilization > this.config.heapUtilizationThreshold) {
      this.emit('memory-pressure', {
        utilization: latest.heapUtilization,
        threshold: this.config.heapUtilizationThreshold,
        recommendations: [
          'Clear unnecessary caches',
          'Release unused object pools',
          'Force garbage collection'
        ]
      });
    }
  }

  /**
   * Calculate memory trends
   */
  private calculateTrends(): {
    growthRate: number;
    gcEfficiency: number;
    volatility: number;
  } {
    if (this.snapshots.length < 10) {
      return { growthRate: 0, gcEfficiency: 1, volatility: 0 };
    }

    const recent = this.snapshots.slice(-10);
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    // Calculate growth rate (bytes per millisecond)
    const startHeap = recent[0].heapUsed;
    const endHeap = recent[recent.length - 1].heapUsed;
    const growthRate = (endHeap - startHeap) / timeSpan;

    // Calculate GC efficiency
    const totalGcFreed = recent.reduce((sum, s) => sum + s.gcActivity.freed, 0);
    const totalHeapGrowth = Math.max(0, endHeap - startHeap);
    const gcEfficiency = totalGcFreed > 0 ? 
      Math.min(1, totalGcFreed / (totalGcFreed + totalHeapGrowth)) : 1;

    // Calculate volatility (standard deviation of heap usage)
    const avgHeap = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const variance = recent.reduce((sum, s) => sum + Math.pow(s.heapUsed - avgHeap, 2), 0) / recent.length;
    const volatility = Math.sqrt(variance) / avgHeap;

    return { growthRate, gcEfficiency, volatility };
  }

  /**
   * Check memory thresholds and emit alerts
   */
  private checkMemoryThresholds(snapshot: MemorySnapshot): void {
    const heapRatio = snapshot.heapUsed / this.config.maxHeapSize;
    const rssRatio = snapshot.rss / this.config.maxRss;

    const maxRatio = Math.max(heapRatio, rssRatio);

    if (maxRatio >= this.config.alertThresholds.critical) {
      this.emit('memory-critical', {
        snapshot,
        heapRatio,
        rssRatio,
        recommendations: [
          'Immediate memory cleanup required',
          'Consider increasing resource limits',
          'Review memory-intensive operations'
        ]
      });
    } else if (maxRatio >= this.config.alertThresholds.warning) {
      this.emit('memory-warning', {
        snapshot,
        heapRatio,
        rssRatio,
        recommendations: [
          'Monitor memory usage closely',
          'Consider proactive cleanup',
          'Review recent operations'
        ]
      });
    }
  }

  /**
   * Setup GC observer for garbage collection monitoring
   */
  private setupGCObserver(): void {
    try {
      // Try to use performance hooks for GC observation
      const perfHooks = require('perf_hooks');
      this.gcObserver = new perfHooks.PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.lastGcStats.collections++;
            this.lastGcStats.duration += entry.duration;
            
            // Estimate freed memory (approximation)
            if (this.snapshots.length > 0) {
              const beforeGc = this.snapshots[this.snapshots.length - 1];
              const currentMem = process.memoryUsage();
              this.lastGcStats.freed += Math.max(0, beforeGc.heapUsed - currentMem.heapUsed);
            }
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      console.warn('GC observer not available:', error);
    }
  }

  /**
   * Generate comprehensive memory profile
   */
  private generateProfile(): MemoryProfile {
    if (this.snapshots.length === 0) {
      return {
        duration: 0,
        snapshots: [],
        statistics: {
          avgHeapUsed: 0,
          maxHeapUsed: 0,
          minHeapUsed: 0,
          avgHeapUtilization: 0,
          maxHeapUtilization: 0,
          growthRate: 0,
          leakDetected: false,
          gcEfficiency: 1
        },
        recommendations: [],
        warnings: []
      };
    }

    const duration = this.snapshots[this.snapshots.length - 1].timestamp - this.snapshots[0].timestamp;
    const heapUsages = this.snapshots.map(s => s.heapUsed);
    const heapUtilizations = this.snapshots.map(s => s.heapUtilization);

    const trends = this.calculateTrends();
    
    const statistics = {
      avgHeapUsed: heapUsages.reduce((a, b) => a + b, 0) / heapUsages.length,
      maxHeapUsed: Math.max(...heapUsages),
      minHeapUsed: Math.min(...heapUsages),
      avgHeapUtilization: heapUtilizations.reduce((a, b) => a + b, 0) / heapUtilizations.length,
      maxHeapUtilization: Math.max(...heapUtilizations),
      growthRate: trends.growthRate,
      leakDetected: trends.growthRate > this.config.memoryLeakThreshold,
      gcEfficiency: trends.gcEfficiency
    };

    const recommendations = this.generateRecommendations(statistics);
    const warnings = this.generateWarnings(statistics);

    return {
      duration,
      snapshots: [...this.snapshots],
      statistics,
      recommendations,
      warnings
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(stats: MemoryProfile['statistics']): string[] {
    const recommendations: string[] = [];

    if (stats.maxHeapUtilization > 0.8) {
      recommendations.push('Consider increasing heap size or optimizing memory usage');
    }

    if (stats.gcEfficiency < 0.7) {
      recommendations.push('Improve garbage collection efficiency by reviewing object lifecycles');
    }

    if (stats.growthRate > 0) {
      recommendations.push('Monitor for potential memory leaks in long-running processes');
    }

    if (stats.avgHeapUtilization > 0.6) {
      recommendations.push('Implement object pooling for frequently created objects');
    }

    // Object pool recommendations
    const poolStats = this.getObjectPoolStatistics();
    const totalReuseRate = Object.values(poolStats).reduce((sum, stats) => sum + stats.reuseRate, 0) / Object.keys(poolStats).length;
    
    if (totalReuseRate < 0.5) {
      recommendations.push('Increase object pool utilization to reduce allocation overhead');
    }

    return recommendations;
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(stats: MemoryProfile['statistics']): string[] {
    const warnings: string[] = [];

    if (stats.leakDetected) {
      warnings.push('Potential memory leak detected - monitor closely');
    }

    if (stats.maxHeapUtilization > 0.9) {
      warnings.push('Memory usage approaching limits - immediate attention required');
    }

    if (stats.gcEfficiency < 0.5) {
      warnings.push('Poor garbage collection efficiency detected');
    }

    return warnings;
  }

  /**
   * Create object pool for specific type
   */
  createObjectPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100
  ): ObjectPool<T> {
    const pool = new ObjectPool(factory, reset, maxSize);
    this.objectPools.set(name, pool as any);
    
    this.emit('object-pool-created', { name, maxSize });
    return pool;
  }

  /**
   * Get object pool by name
   */
  getObjectPool<T>(name: string): ObjectPool<T> | undefined {
    return this.objectPools.get(name) as ObjectPool<T>;
  }

  /**
   * Get statistics for all object pools
   */
  getObjectPoolStatistics(): Record<string, PoolStatistics> {
    const stats: Record<string, PoolStatistics> = {};
    
    for (const [name, pool] of this.objectPools.entries()) {
      stats[name] = pool.getStatistics();
    }
    
    return stats;
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    if (global.gc) {
      global.gc();
      this.emit('gc-forced');
      return true;
    }
    return false;
  }

  /**
   * Clear all object pools
   */
  clearObjectPools(): void {
    for (const [name, pool] of this.objectPools.entries()) {
      pool.clear();
      this.emit('object-pool-cleared', { name });
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemorySnapshot {
    return this.takeSnapshot();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopProfiling();
    
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }
    
    this.clearObjectPools();
    this.snapshots = [];
    
    this.emit('destroyed');
  }
}

/**
 * Generic Object Pool implementation
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private borrowed = new Set<T>();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  private totalCreated = 0;
  private totalReused = 0;

  constructor(factory: () => T, reset: (obj: T) => void, maxSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /**
   * Get object from pool
   */
  acquire(): T {
    let obj = this.available.pop();
    
    if (!obj) {
      obj = this.factory();
      this.totalCreated++;
    } else {
      this.totalReused++;
      this.reset(obj);
    }
    
    this.borrowed.add(obj);
    return obj;
  }

  /**
   * Return object to pool
   */
  release(obj: T): void {
    if (!this.borrowed.has(obj)) {
      return;
    }
    
    this.borrowed.delete(obj);
    
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    const totalRequests = this.totalCreated + this.totalReused;
    return {
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      currentPoolSize: this.available.length,
      maxPoolSize: this.maxSize,
      reuseRate: totalRequests > 0 ? this.totalReused / totalRequests : 0,
      memoryFootprint: (this.available.length + this.borrowed.size) * 100 // Rough estimate
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.available = [];
    this.borrowed.clear();
  }

  /**
   * Get pool size
   */
  size(): number {
    return this.available.length;
  }

  /**
   * Get borrowed count
   */
  borrowedCount(): number {
    return this.borrowed.size;
  }
}