/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryHealthMonitor } from './interfaces.js';
import { MemoryHealthCheck, MemoryMonitoringMetrics, HealthCheckResult } from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory health monitor
 */
export class DefaultMemoryHealthMonitor implements MemoryHealthMonitor {
  private memoryStore: MemoryStore;
  private monitoringTimer?: NodeJS.Timeout;
  private alerts: Alert[] = [];
  private metrics: MemoryMonitoringMetrics;

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
    this.metrics = this.initializeMetrics();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(agentId?: string): Promise<MemoryHealthCheck> {
    try {
      // Get memories to check
      const searchResult = await this.memoryStore.search(agentId ? { agentId } : {});
      const memories = searchResult.items;

      // Perform individual checks
      const integrityCheck = await this.checkMemoryIntegrity(memories);
      const performanceCheck = await this.checkPerformanceMetrics(memories);
      const storageCheck = await this.checkStorageUtilization(memories);
      const accessPatternsCheck = await this.checkAccessPatterns(memories);
      const distributionCheck = await this.checkMemoryDistribution(memories);

      // Calculate overall health score
      const checks = [integrityCheck, performanceCheck, storageCheck, accessPatternsCheck, distributionCheck];
      const averageScore = checks.reduce((sum, check) => sum + check.score, 0) / checks.length;
      
      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (averageScore < 50) {
        status = 'critical';
      } else if (averageScore < 75) {
        status = 'warning';
      }

      // Collect all recommendations
      const recommendations = checks.flatMap(check => check.recommendations);

      return {
        status,
        score: averageScore,
        checks: {
          integrity: integrityCheck,
          performance: performanceCheck,
          storage: storageCheck,
          accessPatterns: accessPatternsCheck,
          distribution: distributionCheck
        },
        recommendations,
        checkedAt: new Date()
      };

    } catch (error) {
      return {
        status: 'critical',
        score: 0,
        checks: {
          integrity: this.createFailedCheck('Failed to perform integrity check'),
          performance: this.createFailedCheck('Failed to perform performance check'),
          storage: this.createFailedCheck('Failed to perform storage check'),
          accessPatterns: this.createFailedCheck('Failed to perform access patterns check'),
          distribution: this.createFailedCheck('Failed to perform distribution check')
        },
        recommendations: [`Health check failed: ${(error as Error).message}`],
        checkedAt: new Date()
      };
    }
  }

  /**
   * Check memory integrity
   */
  async checkIntegrity(memoryIds?: string[]): Promise<{
    validMemories: string[];
    corruptedMemories: string[];
    missingMemories: string[];
    issues: string[];
  }> {
    const validMemories: string[] = [];
    const corruptedMemories: string[] = [];
    const missingMemories: string[] = [];
    const issues: string[] = [];

    try {
      let memoriesToCheck: MemoryItem[] = [];
      
      if (memoryIds) {
        // Check specific memories
        for (const memoryId of memoryIds) {
          try {
            const memory = await this.memoryStore.retrieve(memoryId);
            if (memory) {
              memoriesToCheck.push(memory);
            } else {
              missingMemories.push(memoryId);
            }
          } catch {
            missingMemories.push(memoryId);
          }
        }
      } else {
        // Check all memories
        const searchResult = await this.memoryStore.search({});
        memoriesToCheck = searchResult.items;
      }

      // Validate each memory
      for (const memory of memoriesToCheck) {
        if (this.validateMemoryStructure(memory)) {
          validMemories.push(memory.id);
        } else {
          corruptedMemories.push(memory.id);
          issues.push(`Memory ${memory.id} has invalid structure`);
        }
      }

    } catch (error) {
      issues.push(`Integrity check failed: ${(error as Error).message}`);
    }

    return {
      validMemories,
      corruptedMemories,
      missingMemories,
      issues
    };
  }

  /**
   * Monitor memory performance
   */
  async monitorPerformance(): Promise<{
    averageQueryTime: number;
    slowQueries: number;
    memoryUtilization: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    try {
      // Update metrics
      await this.updateMetrics();
      
      const { queryPerformance } = this.metrics;
      const memoryUtilization = await this.calculateMemoryUtilization();

      // Generate recommendations
      if (queryPerformance.averageQueryTime > 1000) {
        recommendations.push('Average query time is high - consider optimizing queries or adding indexes');
      }
      
      if (queryPerformance.slowQueryCount > 10) {
        recommendations.push('High number of slow queries detected - investigate query patterns');
      }
      
      if (memoryUtilization > 0.8) {
        recommendations.push('Memory utilization is high - consider pruning old memories');
      }

      return {
        averageQueryTime: queryPerformance.averageQueryTime,
        slowQueries: queryPerformance.slowQueryCount,
        memoryUtilization,
        recommendations
      };

    } catch (error) {
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        memoryUtilization: 0,
        recommendations: [`Performance monitoring failed: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Get health metrics
   */
  async getHealthMetrics(): Promise<MemoryMonitoringMetrics> {
    await this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Start continuous health monitoring
   */
  async startHealthMonitoring(interval: number = 60000): Promise<void> {
    if (this.monitoringTimer) {
      return;
    }

    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performContinuousHealthCheck();
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, interval);
  }

  /**
   * Stop health monitoring
   */
  async stopHealthMonitoring(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Get monitoring alerts
   */
  async getAlerts(): Promise<Array<{
    id: string;
    type: 'warning' | 'critical';
    message: string;
    agentId?: string;
    memoryId?: string;
    timestamp: Date;
  }>> {
    return [...this.alerts];
  }

  /**
   * Check memory integrity for a set of memories
   */
  private async checkMemoryIntegrity(memories: MemoryItem[]): Promise<HealthCheckResult> {
    let validCount = 0;
    let corruptedCount = 0;
    const issues: string[] = [];

    for (const memory of memories) {
      if (this.validateMemoryStructure(memory)) {
        validCount++;
      } else {
        corruptedCount++;
        issues.push(`Memory ${memory.id} has invalid structure`);
      }
    }

    const score = memories.length > 0 ? (validCount / memories.length) * 100 : 100;
    const status = score === 100 ? 'pass' : score > 90 ? 'warning' : 'fail';

    return {
      status,
      score,
      message: `${validCount}/${memories.length} memories are valid`,
      metrics: {
        validMemories: validCount,
        corruptedMemories: corruptedCount,
        totalMemories: memories.length
      },
      recommendations: corruptedCount > 0 ? ['Investigate corrupted memories and restore from backup'] : []
    };
  }

  /**
   * Check performance metrics
   */
  private async checkPerformanceMetrics(memories: MemoryItem[]): Promise<HealthCheckResult> {
    await this.updateMetrics();
    
    const { queryPerformance } = this.metrics;
    const score = Math.max(0, 100 - (queryPerformance.averageQueryTime / 10));
    const status = score > 80 ? 'pass' : score > 50 ? 'warning' : 'fail';

    const recommendations: string[] = [];
    if (queryPerformance.averageQueryTime > 500) {
      recommendations.push('Consider optimizing query performance');
    }
    if (queryPerformance.slowQueryCount > 5) {
      recommendations.push('Investigate slow queries');
    }

    return {
      status,
      score,
      message: `Average query time: ${queryPerformance.averageQueryTime}ms`,
      metrics: {
        averageQueryTime: queryPerformance.averageQueryTime,
        slowQueryCount: queryPerformance.slowQueryCount,
        queryThroughput: queryPerformance.queryThroughput
      },
      recommendations
    };
  }

  /**
   * Check storage utilization
   */
  private async checkStorageUtilization(memories: MemoryItem[]): Promise<HealthCheckResult> {
    const totalSize = memories.reduce((sum, memory) => sum + JSON.stringify(memory).length, 0);
    const utilization = await this.calculateMemoryUtilization();
    
    const score = Math.max(0, 100 - (utilization * 100));
    const status = score > 75 ? 'pass' : score > 50 ? 'warning' : 'fail';

    const recommendations: string[] = [];
    if (utilization > 0.8) {
      recommendations.push('Storage utilization is high - consider archiving old memories');
    }

    return {
      status,
      score,
      message: `Storage utilization: ${(utilization * 100).toFixed(1)}%`,
      metrics: {
        totalSize,
        utilization,
        memoryCount: memories.length
      },
      recommendations
    };
  }

  /**
   * Check access patterns
   */
  private async checkAccessPatterns(memories: MemoryItem[]): Promise<HealthCheckResult> {
    const accessCounts = memories.map(m => m.metadata?.accessCount || 0);
    const unusedCount = accessCounts.filter(count => count === 0).length;
    const unusedPercentage = memories.length > 0 ? (unusedCount / memories.length) * 100 : 0;
    
    const score = Math.max(0, 100 - unusedPercentage);
    const status = score > 80 ? 'pass' : score > 60 ? 'warning' : 'fail';

    const recommendations: string[] = [];
    if (unusedPercentage > 30) {
      recommendations.push('High percentage of unused memories - consider pruning');
    }

    return {
      status,
      score,
      message: `${unusedPercentage.toFixed(1)}% of memories are unused`,
      metrics: {
        unusedMemories: unusedCount,
        totalMemories: memories.length,
        unusedPercentage
      },
      recommendations
    };
  }

  /**
   * Check memory distribution
   */
  private async checkMemoryDistribution(memories: MemoryItem[]): Promise<HealthCheckResult> {
    const agentCounts = new Map<string, number>();
    
    for (const memory of memories) {
      agentCounts.set(memory.agentId, (agentCounts.get(memory.agentId) || 0) + 1);
    }

    // Check for imbalanced distribution
    const counts = Array.from(agentCounts.values());
    const average = counts.reduce((sum, count) => sum + count, 0) / counts.length;
    const imbalanced = counts.some(count => count > average * 2);

    const score = imbalanced ? 60 : 90;
    const status = score > 80 ? 'pass' : 'warning';

    const recommendations: string[] = [];
    if (imbalanced) {
      recommendations.push('Memory distribution is imbalanced across agents');
    }

    return {
      status,
      score,
      message: `Memory distributed across ${agentCounts.size} agents`,
      metrics: {
        agentCount: agentCounts.size,
        averageMemoriesPerAgent: average,
        imbalanced
      },
      recommendations
    };
  }

  /**
   * Validate memory structure
   */
  private validateMemoryStructure(memory: MemoryItem): boolean {
    return !!(
      memory.id &&
      memory.type &&
      memory.agentId &&
      memory.content &&
      memory.metadata
    );
  }

  /**
   * Calculate memory utilization
   */
  private async calculateMemoryUtilization(): Promise<number> {
    // In a real implementation, this would check actual memory usage
    // For now, return a simulated value
    return 0.6; // 60% utilization
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const searchResult = await this.memoryStore.search({});
      const memories = searchResult.items;

      this.metrics = {
        currentMemoryCount: memories.length,
        memoryGrowthRate: 0.1, // 10% growth per day (simulated)
        averageAccessFrequency: memories.reduce((sum, m) => sum + (m.metadata?.accessCount || 0), 0) / memories.length,
        storageUtilization: await this.calculateMemoryUtilization(),
        queryPerformance: {
          averageQueryTime: 150, // Simulated value
          slowQueryCount: 2, // Simulated value
          queryThroughput: 100 // Simulated value
        },
        operations: {
          storeOperations: 100,
          retrieveOperations: 500,
          updateOperations: 50,
          deleteOperations: 10
        },
        errorRates: {
          storageErrors: 0,
          retrievalErrors: 1,
          corruptionErrors: 0
        },
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }

  /**
   * Perform continuous health check
   */
  private async performContinuousHealthCheck(): Promise<void> {
    const healthCheck = await this.performHealthCheck();
    
    // Generate alerts based on health check results
    if (healthCheck.status === 'critical') {
      this.addAlert('critical', 'Critical health issues detected');
    } else if (healthCheck.status === 'warning') {
      this.addAlert('warning', 'Health warning detected');
    }
  }

  /**
   * Add alert
   */
  private addAlert(type: 'warning' | 'critical', message: string, agentId?: string, memoryId?: string): void {
    const alert: Alert = {
      id: uuidv4(),
      type,
      message,
      agentId,
      memoryId,
      timestamp: new Date()
    };

    this.alerts.push(alert);
    
    // Keep only recent alerts (last 1000)
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }
  }

  /**
   * Create failed check result
   */
  private createFailedCheck(message: string): HealthCheckResult {
    return {
      status: 'fail',
      score: 0,
      message,
      metrics: {},
      recommendations: []
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): MemoryMonitoringMetrics {
    return {
      currentMemoryCount: 0,
      memoryGrowthRate: 0,
      averageAccessFrequency: 0,
      storageUtilization: 0,
      queryPerformance: {
        averageQueryTime: 0,
        slowQueryCount: 0,
        queryThroughput: 0
      },
      operations: {
        storeOperations: 0,
        retrieveOperations: 0,
        updateOperations: 0,
        deleteOperations: 0
      },
      errorRates: {
        storageErrors: 0,
        retrievalErrors: 0,
        corruptionErrors: 0
      },
      timestamp: new Date()
    };
  }
}

/**
 * Alert interface
 */
interface Alert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  agentId?: string;
  memoryId?: string;
  timestamp: Date;
}