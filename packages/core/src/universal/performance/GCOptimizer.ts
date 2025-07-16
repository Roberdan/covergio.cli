/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';

/**
 * GC optimization configuration
 */
export interface GCOptimizerConfig {
  enableAdaptiveGC: boolean;
  gcTriggerThreshold: number;
  maxHeapUtilization: number;
  forcedGCInterval: number;
  memoryPressureThreshold: number;
  enableGCLogging: boolean;
  optimizationStrategy: 'aggressive' | 'balanced' | 'conservative';
  heapSizeTarget: number;
}

/**
 * GC statistics interface
 */
export interface GCStatistics {
  totalCollections: number;
  totalDuration: number;
  averageDuration: number;
  lastCollection: number;
  frequency: number;
  efficiency: number;
  memoryFreed: number;
  heapGrowthRate: number;
  recommendedAction: 'none' | 'optimize' | 'force' | 'increase_heap';
}

/**
 * Memory pressure levels
 */
export enum MemoryPressureLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * GC timing information
 */
export interface GCTiming {
  timestamp: number;
  duration: number;
  type: string;
  heapBefore: number;
  heapAfter: number;
  memoryFreed: number;
}

/**
 * Advanced Garbage Collection Optimizer
 */
export class GCOptimizer extends EventEmitter {
  private config: GCOptimizerConfig;
  private gcTimings: GCTiming[] = [];
  private lastForcedGC = 0;
  private gcObserver: any;
  private monitoringInterval?: NodeJS.Timeout;
  private optimizationInterval?: NodeJS.Timeout;
  private memoryBaseline = 0;
  private lastMemoryCheck = 0;

  constructor(config: Partial<GCOptimizerConfig> = {}) {
    super();

    this.config = {
      enableAdaptiveGC: true,
      gcTriggerThreshold: 0.8, // 80% heap utilization
      maxHeapUtilization: 0.9, // 90% max heap
      forcedGCInterval: 300000, // 5 minutes
      memoryPressureThreshold: 0.85, // 85% memory pressure threshold
      enableGCLogging: false,
      optimizationStrategy: 'balanced',
      heapSizeTarget: 512 * 1024 * 1024, // 512MB target
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize GC optimizer
   */
  private initialize(): void {
    this.setupGCObserver();
    this.startMonitoring();
    this.startOptimization();
    this.recordMemoryBaseline();

    this.emit('initialized', { config: this.config });
  }

  /**
   * Setup GC observer for monitoring
   */
  private setupGCObserver(): void {
    try {
      const perfHooks = require('perf_hooks');
      this.gcObserver = new perfHooks.PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.recordGCEvent(entry);
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      console.warn('GC observer not available:', error);
    }
  }

  /**
   * Record GC event
   */
  private recordGCEvent(entry: any): void {
    const memBefore = this.getMemoryUsage();
    
    // Simulate memory after GC (in real implementation, this would be tracked differently)
    const estimatedFreed = memBefore.heapUsed * 0.1; // Rough estimation
    
    const timing: GCTiming = {
      timestamp: entry.startTime + performance.timeOrigin,
      duration: entry.duration,
      type: this.getGCType(entry),
      heapBefore: memBefore.heapUsed,
      heapAfter: memBefore.heapUsed - estimatedFreed,
      memoryFreed: estimatedFreed
    };

    this.gcTimings.push(timing);

    // Keep only last 100 GC events
    if (this.gcTimings.length > 100) {
      this.gcTimings = this.gcTimings.slice(-100);
    }

    if (this.config.enableGCLogging) {
      this.logGCEvent(timing);
    }

    this.emit('gc-event', timing);
    this.analyzeGCPerformance();
  }

  /**
   * Get GC type from entry
   */
  private getGCType(entry: any): string {
    // This would be implementation-specific based on Node.js version
    return entry.detail?.kind || 'unknown';
  }

  /**
   * Log GC event
   */
  private logGCEvent(timing: GCTiming): void {
    console.log(`[GC] ${timing.type} - Duration: ${timing.duration.toFixed(2)}ms, ` +
                `Freed: ${(timing.memoryFreed / 1024 / 1024).toFixed(2)}MB, ` +
                `Heap: ${(timing.heapAfter / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * Start monitoring memory and GC patterns
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryPressure();
      this.updateGCStatistics();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start optimization routine
   */
  private startOptimization(): void {
    this.optimizationInterval = setInterval(() => {
      if (this.config.enableAdaptiveGC) {
        this.performAdaptiveOptimization();
      }
    }, 30000); // Optimize every 30 seconds
  }

  /**
   * Record memory baseline
   */
  private recordMemoryBaseline(): void {
    const memUsage = this.getMemoryUsage();
    this.memoryBaseline = memUsage.heapUsed;
    this.lastMemoryCheck = Date.now();
  }

  /**
   * Check current memory pressure
   */
  private checkMemoryPressure(): MemoryPressureLevel {
    const memUsage = this.getMemoryUsage();
    const utilization = memUsage.heapUsed / memUsage.heapTotal;

    let pressureLevel: MemoryPressureLevel;

    if (utilization >= 0.95) {
      pressureLevel = MemoryPressureLevel.CRITICAL;
    } else if (utilization >= this.config.memoryPressureThreshold) {
      pressureLevel = MemoryPressureLevel.HIGH;
    } else if (utilization >= 0.7) {
      pressureLevel = MemoryPressureLevel.MODERATE;
    } else {
      pressureLevel = MemoryPressureLevel.LOW;
    }

    this.emit('memory-pressure-check', {
      level: pressureLevel,
      utilization,
      memoryUsage: memUsage
    });

    // Trigger optimization based on pressure level
    if (pressureLevel === MemoryPressureLevel.CRITICAL) {
      this.forceGarbageCollection('critical-pressure');
    } else if (pressureLevel === MemoryPressureLevel.HIGH) {
      this.scheduleOptimization();
    }

    return pressureLevel;
  }

  /**
   * Perform adaptive optimization based on current state
   */
  private performAdaptiveOptimization(): void {
    const memUsage = this.getMemoryUsage();
    const stats = this.getGCStatistics();
    const pressureLevel = this.checkMemoryPressure();

    const optimization = this.determineOptimizationStrategy(memUsage, stats, pressureLevel);

    switch (optimization.action) {
      case 'force-gc':
        this.forceGarbageCollection('adaptive-optimization');
        break;
      case 'schedule-gc':
        this.scheduleOptimization();
        break;
      case 'increase-frequency':
        this.increaseGCFrequency();
        break;
      case 'reduce-frequency':
        this.reduceGCFrequency();
        break;
      case 'none':
      default:
        // No action needed
        break;
    }

    this.emit('adaptive-optimization', {
      action: optimization.action,
      reason: optimization.reason,
      memoryUsage: memUsage,
      statistics: stats
    });
  }

  /**
   * Determine optimization strategy
   */
  private determineOptimizationStrategy(
    memUsage: NodeJS.MemoryUsage,
    stats: GCStatistics,
    pressureLevel: MemoryPressureLevel
  ): { action: string; reason: string } {
    const utilization = memUsage.heapUsed / memUsage.heapTotal;
    const timeSinceLastGC = Date.now() - this.lastForcedGC;
    
    // Critical situations - force GC immediately
    if (utilization > this.config.maxHeapUtilization) {
      return {
        action: 'force-gc',
        reason: `Heap utilization ${(utilization * 100).toFixed(1)}% exceeds threshold ${(this.config.maxHeapUtilization * 100).toFixed(1)}%`
      };
    }

    // High pressure with poor GC efficiency
    if (pressureLevel === MemoryPressureLevel.HIGH && stats.efficiency < 0.5) {
      return {
        action: 'force-gc',
        reason: `High memory pressure with low GC efficiency (${(stats.efficiency * 100).toFixed(1)}%)`
      };
    }

    // Regular maintenance GC
    if (timeSinceLastGC > this.config.forcedGCInterval && utilization > this.config.gcTriggerThreshold) {
      return {
        action: 'force-gc',
        reason: `Scheduled maintenance GC after ${timeSinceLastGC}ms`
      };
    }

    // Adaptive frequency adjustment
    if (stats.frequency > 10 && stats.efficiency > 0.8) {
      return {
        action: 'reduce-frequency',
        reason: 'GC is efficient, reducing frequency'
      };
    }

    if (stats.frequency < 2 && utilization > 0.6) {
      return {
        action: 'increase-frequency',
        reason: 'Low GC frequency with moderate memory usage'
      };
    }

    return {
      action: 'none',
      reason: 'No optimization needed'
    };
  }

  /**
   * Force garbage collection
   */
  forceGarbageCollection(reason: string = 'manual'): boolean {
    if (!global.gc) {
      this.emit('gc-unavailable', { reason });
      return false;
    }

    const beforeMemory = this.getMemoryUsage();
    const startTime = Date.now();

    try {
      global.gc();
      
      const afterMemory = this.getMemoryUsage();
      const duration = Date.now() - startTime;
      const memoryFreed = beforeMemory.heapUsed - afterMemory.heapUsed;

      this.lastForcedGC = Date.now();

      // Record forced GC event
      const timing: GCTiming = {
        timestamp: startTime,
        duration,
        type: 'forced',
        heapBefore: beforeMemory.heapUsed,
        heapAfter: afterMemory.heapUsed,
        memoryFreed
      };

      this.gcTimings.push(timing);

      this.emit('gc-forced', {
        reason,
        timing,
        memoryFreed,
        beforeMemory,
        afterMemory
      });

      return true;
    } catch (error) {
      this.emit('gc-error', { reason, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Schedule optimization
   */
  private scheduleOptimization(): void {
    // Schedule GC to run on next tick to avoid blocking current operation
    setImmediate(() => {
      this.forceGarbageCollection('scheduled');
    });
  }

  /**
   * Increase GC frequency (implementation-specific)
   */
  private increaseGCFrequency(): void {
    // This would involve Node.js specific optimizations
    // For now, we'll emit an event for monitoring
    this.emit('gc-frequency-adjusted', { direction: 'increase' });
  }

  /**
   * Reduce GC frequency (implementation-specific)
   */
  private reduceGCFrequency(): void {
    // This would involve Node.js specific optimizations
    // For now, we'll emit an event for monitoring
    this.emit('gc-frequency-adjusted', { direction: 'reduce' });
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Update and calculate GC statistics
   */
  private updateGCStatistics(): void {
    const stats = this.getGCStatistics();
    this.emit('gc-statistics-updated', stats);
  }

  /**
   * Get comprehensive GC statistics
   */
  getGCStatistics(): GCStatistics {
    if (this.gcTimings.length === 0) {
      return {
        totalCollections: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastCollection: 0,
        frequency: 0,
        efficiency: 1,
        memoryFreed: 0,
        heapGrowthRate: 0,
        recommendedAction: 'none'
      };
    }

    const totalCollections = this.gcTimings.length;
    const totalDuration = this.gcTimings.reduce((sum, timing) => sum + timing.duration, 0);
    const totalFreed = this.gcTimings.reduce((sum, timing) => sum + timing.memoryFreed, 0);

    const lastCollection = this.gcTimings[this.gcTimings.length - 1].timestamp;
    const firstCollection = this.gcTimings[0].timestamp;
    const timeSpan = lastCollection - firstCollection;

    const frequency = timeSpan > 0 ? (totalCollections / timeSpan) * 60000 : 0; // Collections per minute

    // Calculate efficiency (memory freed vs time spent)
    const efficiency = totalDuration > 0 ? Math.min(1, totalFreed / (totalDuration * 1000)) : 1;

    // Calculate heap growth rate
    const currentMemory = this.getMemoryUsage().heapUsed;
    const timeSinceBaseline = Date.now() - this.lastMemoryCheck;
    const heapGrowthRate = timeSinceBaseline > 0 ? 
      (currentMemory - this.memoryBaseline) / timeSinceBaseline : 0;

    // Determine recommended action
    let recommendedAction: GCStatistics['recommendedAction'] = 'none';
    const currentUtilization = currentMemory / this.getMemoryUsage().heapTotal;

    if (currentUtilization > this.config.maxHeapUtilization) {
      recommendedAction = 'force';
    } else if (efficiency < 0.5 || frequency > 10) {
      recommendedAction = 'optimize';
    } else if (heapGrowthRate > 1000) { // 1KB per ms growth
      recommendedAction = 'increase_heap';
    }

    return {
      totalCollections,
      totalDuration,
      averageDuration: totalDuration / totalCollections,
      lastCollection,
      frequency,
      efficiency,
      memoryFreed: totalFreed,
      heapGrowthRate,
      recommendedAction
    };
  }

  /**
   * Analyze GC performance and emit insights
   */
  private analyzeGCPerformance(): void {
    if (this.gcTimings.length < 5) return;

    const recentTimings = this.gcTimings.slice(-5);
    const avgDuration = recentTimings.reduce((sum, t) => sum + t.duration, 0) / recentTimings.length;
    const avgFreed = recentTimings.reduce((sum, t) => sum + t.memoryFreed, 0) / recentTimings.length;

    // Detect performance issues
    if (avgDuration > 100) { // Long GC pauses
      this.emit('gc-performance-issue', {
        issue: 'long-pauses',
        averageDuration: avgDuration,
        recommendations: [
          'Consider using incremental GC',
          'Reduce large object allocations',
          'Optimize object lifecycle management'
        ]
      });
    }

    if (avgFreed < 1024 * 1024) { // Low memory recovery
      this.emit('gc-performance-issue', {
        issue: 'low-memory-recovery',
        averageFreed: avgFreed,
        recommendations: [
          'Check for memory leaks',
          'Review object retention patterns',
          'Consider manual memory management'
        ]
      });
    }

    // Detect GC thrashing
    const recent = this.gcTimings.slice(-10);
    if (recent.length === 10) {
      const timeSpan = recent[9].timestamp - recent[0].timestamp;
      const frequency = (10 / timeSpan) * 1000; // GCs per second
      
      if (frequency > 0.1) { // More than 1 GC per 10 seconds
        this.emit('gc-performance-issue', {
          issue: 'gc-thrashing',
          frequency,
          recommendations: [
            'Reduce allocation rate',
            'Increase heap size',
            'Optimize memory usage patterns'
          ]
        });
      }
    }
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const stats = this.getGCStatistics();
    const memUsage = this.getMemoryUsage();
    const utilization = memUsage.heapUsed / memUsage.heapTotal;
    
    const recommendations: string[] = [];

    if (utilization > 0.8) {
      recommendations.push('High memory utilization - consider increasing heap size or reducing memory usage');
    }

    if (stats.efficiency < 0.5) {
      recommendations.push('Low GC efficiency - review object lifecycle and avoid memory leaks');
    }

    if (stats.frequency > 5) {
      recommendations.push('High GC frequency - optimize allocation patterns and object pooling');
    }

    if (stats.averageDuration > 50) {
      recommendations.push('Long GC pauses - reduce large object allocations and implement incremental processing');
    }

    if (stats.heapGrowthRate > 500) {
      recommendations.push('Rapid heap growth detected - monitor for memory leaks');
    }

    if (recommendations.length === 0) {
      recommendations.push('GC performance is optimal');
    }

    return recommendations;
  }

  /**
   * Export GC timing data for analysis
   */
  exportTimingData(): GCTiming[] {
    return [...this.gcTimings];
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.gcTimings = [];
    this.recordMemoryBaseline();
    this.emit('statistics-reset');
  }

  /**
   * Cleanup and destroy optimizer
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    this.emit('destroyed');
  }
}