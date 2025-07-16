/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryOptimizationSystem } from './interfaces.js';
import { MemoryOptimizer } from './interfaces.js';
import { MemoryAnalytics } from './interfaces.js';
import { MemoryPersistence } from './interfaces.js';
import { MemoryBackup } from './interfaces.js';
import { MemoryHealthMonitor } from './interfaces.js';
import { MemoryPortability } from './interfaces.js';
import { MemoryVisualizer } from './interfaces.js';
import { MemoryDebugger } from './interfaces.js';

import { DefaultMemoryOptimizer } from './MemoryOptimizer.js';
import { DefaultMemoryAnalytics } from './MemoryAnalytics.js';
import { DefaultMemoryPersistence } from './MemoryPersistence.js';
import { DefaultMemoryBackup } from './MemoryBackup.js';
import { DefaultMemoryHealthMonitor } from './MemoryHealthMonitor.js';
import { DefaultMemoryPortability } from './MemoryPortability.js';
import { DefaultMemoryVisualizer } from './MemoryVisualizer.js';
import { DefaultMemoryDebugger } from './MemoryDebugger.js';

import { MemoryStore } from '../interfaces.js';
import { MemoryOptimizationConfig, BackupConfig, ArchivingConfig } from './types.js';

/**
 * Default implementation of memory optimization system
 */
export class DefaultMemoryOptimizationSystem implements MemoryOptimizationSystem {
  private memoryStore: MemoryStore;
  private optimizer: MemoryOptimizer;
  private analytics: MemoryAnalytics;
  private persistence: MemoryPersistence;
  private backup: MemoryBackup;
  private healthMonitor: MemoryHealthMonitor;
  private portability: MemoryPortability;
  private visualizer: MemoryVisualizer;
  private debugger: MemoryDebugger;
  private initialized = false;

  constructor(
    memoryStore: MemoryStore,
    config?: {
      optimization?: Partial<MemoryOptimizationConfig>;
      backup?: Partial<BackupConfig>;
      archiving?: Partial<ArchivingConfig>;
    }
  ) {
    this.memoryStore = memoryStore;
    
    // Initialize components
    this.optimizer = new DefaultMemoryOptimizer(memoryStore, config?.optimization);
    this.analytics = new DefaultMemoryAnalytics(memoryStore);
    this.persistence = new DefaultMemoryPersistence(memoryStore, config?.archiving);
    this.backup = new DefaultMemoryBackup(memoryStore, config?.backup);
    this.healthMonitor = new DefaultMemoryHealthMonitor(memoryStore);
    this.portability = new DefaultMemoryPortability(memoryStore);
    this.visualizer = new DefaultMemoryVisualizer(memoryStore);
    this.debugger = new DefaultMemoryDebugger(memoryStore);
  }

  /**
   * Initialize the optimization system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Configure components
      await this.configureComponents();

      // Start monitoring services
      await this.startMonitoringServices();

      // Perform initial health check
      await this.performInitialHealthCheck();

      this.initialized = true;

    } catch (error) {
      throw new Error(`Failed to initialize memory optimization system: ${(error as Error).message}`);
    }
  }

  /**
   * Get memory optimizer
   */
  getOptimizer(): MemoryOptimizer {
    this.ensureInitialized();
    return this.optimizer;
  }

  /**
   * Get memory analytics
   */
  getAnalytics(): MemoryAnalytics {
    this.ensureInitialized();
    return this.analytics;
  }

  /**
   * Get memory persistence
   */
  getPersistence(): MemoryPersistence {
    this.ensureInitialized();
    return this.persistence;
  }

  /**
   * Get memory backup
   */
  getBackup(): MemoryBackup {
    this.ensureInitialized();
    return this.backup;
  }

  /**
   * Get health monitor
   */
  getHealthMonitor(): MemoryHealthMonitor {
    this.ensureInitialized();
    return this.healthMonitor;
  }

  /**
   * Get portability manager
   */
  getPortability(): MemoryPortability {
    this.ensureInitialized();
    return this.portability;
  }

  /**
   * Get visualizer
   */
  getVisualizer(): MemoryVisualizer {
    this.ensureInitialized();
    return this.visualizer;
  }

  /**
   * Get debugger
   */
  getDebugger(): MemoryDebugger {
    this.ensureInitialized();
    return this.debugger;
  }

  /**
   * Shutdown the optimization system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // Stop monitoring services
      await this.stopMonitoringServices();

      // Perform final backup
      await this.performFinalBackup();

      // Reset initialization state
      this.initialized = false;

    } catch (error) {
      console.error('Error during shutdown:', error);
      throw new Error(`Failed to shutdown memory optimization system: ${(error as Error).message}`);
    }
  }

  /**
   * Configure system components
   */
  private async configureComponents(): Promise<void> {
    // Configure optimizer for auto-optimization
    await this.optimizer.startAutoOptimization();

    // Configure backup for auto-backup
    await this.backup.startAutoBackup();

    // Configure health monitoring
    await this.healthMonitor.startHealthMonitoring();
  }

  /**
   * Start monitoring services
   */
  private async startMonitoringServices(): Promise<void> {
    // Services are already started in configureComponents
    // This method is reserved for future monitoring services
  }

  /**
   * Stop monitoring services
   */
  private async stopMonitoringServices(): Promise<void> {
    try {
      await this.optimizer.stopAutoOptimization();
      await this.backup.stopAutoBackup();
      await this.healthMonitor.stopHealthMonitoring();
    } catch (error) {
      console.error('Error stopping monitoring services:', error);
    }
  }

  /**
   * Perform initial health check
   */
  private async performInitialHealthCheck(): Promise<void> {
    try {
      const healthCheck = await this.healthMonitor.performHealthCheck();
      
      if (healthCheck.status === 'critical') {
        console.warn('Memory system health check indicates critical issues:', healthCheck.recommendations);
      } else if (healthCheck.status === 'warning') {
        console.info('Memory system health check indicates warnings:', healthCheck.recommendations);
      }

      // Generate initial analytics report
      const report = await this.analytics.generateReport();
      console.log('Initial memory analytics report generated');

    } catch (error) {
      console.error('Initial health check failed:', error);
    }
  }

  /**
   * Perform final backup before shutdown
   */
  private async performFinalBackup(): Promise<void> {
    try {
      await this.backup.createBackup('shutdown-backup');
      console.log('Final backup created successfully');
    } catch (error) {
      console.error('Failed to create final backup:', error);
    }
  }

  /**
   * Ensure system is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Memory optimization system not initialized. Call initialize() first.');
    }
  }

  /**
   * Create comprehensive memory optimization system
   */
  static async create(
    memoryStore: MemoryStore,
    config?: {
      optimization?: Partial<MemoryOptimizationConfig>;
      backup?: Partial<BackupConfig>;
      archiving?: Partial<ArchivingConfig>;
    }
  ): Promise<MemoryOptimizationSystem> {
    const system = new DefaultMemoryOptimizationSystem(memoryStore, config);
    await system.initialize();
    return system;
  }

  /**
   * Perform comprehensive optimization
   */
  async performComprehensiveOptimization(agentId?: string): Promise<{
    optimizationResult: any;
    analyticsReport: string;
    healthCheck: any;
    backupCreated: boolean;
  }> {
    this.ensureInitialized();

    try {
      // Perform optimization
      const optimizationResult = agentId 
        ? await this.optimizer.optimizeAgent(agentId)
        : await this.optimizer.optimizeAll();

      // Generate analytics report
      const analyticsReport = await this.analytics.generateReport(agentId);

      // Perform health check
      const healthCheck = await this.healthMonitor.performHealthCheck(agentId);

      // Create backup
      let backupCreated = false;
      try {
        await this.backup.createBackup(`optimization-${new Date().toISOString()}`);
        backupCreated = true;
      } catch (error) {
        console.warn('Failed to create backup after optimization:', error);
      }

      return {
        optimizationResult,
        analyticsReport,
        healthCheck,
        backupCreated
      };

    } catch (error) {
      throw new Error(`Comprehensive optimization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{
    initialized: boolean;
    optimizerStatus: any;
    healthMetrics: any;
    backupStatus: any;
    lastOptimization: Date;
  }> {
    if (!this.initialized) {
      return {
        initialized: false,
        optimizerStatus: null,
        healthMetrics: null,
        backupStatus: null,
        lastOptimization: new Date(0)
      };
    }

    try {
      const optimizerStatus = await this.optimizer.getOptimizationStatus();
      const healthMetrics = await this.healthMonitor.getHealthMetrics();
      const backupList = await this.backup.listBackups();
      const lastBackup = backupList.length > 0 ? backupList[0].createdAt : new Date(0);

      return {
        initialized: true,
        optimizerStatus,
        healthMetrics,
        backupStatus: {
          lastBackup,
          backupCount: backupList.length
        },
        lastOptimization: optimizerStatus.lastOptimization
      };

    } catch (error) {
      throw new Error(`Failed to get system status: ${(error as Error).message}`);
    }
  }

  /**
   * Emergency recovery procedure
   */
  async emergencyRecovery(backupId?: string): Promise<{
    success: boolean;
    message: string;
    recoveredMemories: number;
  }> {
    this.ensureInitialized();

    try {
      let targetBackupId = backupId;
      
      if (!targetBackupId) {
        // Find most recent backup
        const backups = await this.backup.listBackups();
        if (backups.length === 0) {
          throw new Error('No backups available for recovery');
        }
        targetBackupId = backups[0].id;
      }

      // Restore from backup
      const restoreResult = await this.backup.restoreFromBackup(targetBackupId, {
        overwrite: true
      });

      if (restoreResult.success) {
        // Perform integrity check
        const integrityCheck = await this.healthMonitor.checkIntegrity();
        
        return {
          success: true,
          message: `Emergency recovery completed. Restored ${restoreResult.memoriesProcessed} memories from backup ${targetBackupId}`,
          recoveredMemories: restoreResult.memoriesProcessed
        };
      } else {
        throw new Error(restoreResult.message);
      }

    } catch (error) {
      return {
        success: false,
        message: `Emergency recovery failed: ${(error as Error).message}`,
        recoveredMemories: 0
      };
    }
  }
}