/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MemoryOptimizationConfig,
  MemoryOptimizationResult,
  ConsolidationRule,
  MemoryUsageAnalytics,
  PruningCriteria,
  ArchivingConfig,
  BackupConfig,
  MemoryHealthCheck,
  MemoryPortabilityConfig,
  MemoryExportResult,
  MemoryImportResult,
  MemoryVisualizationData,
  MemoryDebugInfo,
  MemoryMonitoringMetrics
} from './types.js';
import { MemoryItem } from '../types.js';

/**
 * Interface for memory optimization operations
 */
export interface MemoryOptimizer {
  /**
   * Configure optimization settings
   */
  configure(config: MemoryOptimizationConfig): Promise<void>;

  /**
   * Optimize memory for a specific agent
   */
  optimizeAgent(agentId: string): Promise<MemoryOptimizationResult>;

  /**
   * Optimize all memories
   */
  optimizeAll(): Promise<MemoryOptimizationResult>;

  /**
   * Prune memories based on criteria
   */
  pruneMemories(criteria: PruningCriteria): Promise<MemoryOptimizationResult>;

  /**
   * Consolidate similar memories
   */
  consolidateMemories(rules: ConsolidationRule[]): Promise<MemoryOptimizationResult>;

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(agentId?: string): Promise<string[]>;

  /**
   * Start automatic optimization
   */
  startAutoOptimization(): Promise<void>;

  /**
   * Stop automatic optimization
   */
  stopAutoOptimization(): Promise<void>;

  /**
   * Get optimization status
   */
  getOptimizationStatus(): Promise<{
    enabled: boolean;
    lastOptimization: Date;
    nextOptimization: Date;
    config: MemoryOptimizationConfig;
  }>;
}

/**
 * Interface for memory analytics
 */
export interface MemoryAnalytics {
  /**
   * Analyze memory usage patterns
   */
  analyzeUsage(agentId?: string): Promise<MemoryUsageAnalytics>;

  /**
   * Get memory distribution statistics
   */
  getDistributionStats(): Promise<{
    byType: Map<string, number>;
    byAgent: Map<string, number>;
    byScope: Map<string, number>;
    byAge: Map<string, number>;
  }>;

  /**
   * Get access pattern analysis
   */
  getAccessPatterns(agentId?: string): Promise<{
    peakAccessTimes: string[];
    accessFrequency: Map<string, number>;
    popularMemories: MemoryItem[];
    unusedMemories: MemoryItem[];
  }>;

  /**
   * Get memory growth trends
   */
  getGrowthTrends(period?: string): Promise<{
    growthRate: number;
    projectedGrowth: number;
    trendsData: Array<{
      date: Date;
      memoryCount: number;
      storageSize: number;
    }>;
  }>;

  /**
   * Generate analytics report
   */
  generateReport(agentId?: string): Promise<string>;
}

/**
 * Interface for memory persistence operations
 */
export interface MemoryPersistence {
  /**
   * Configure archiving settings
   */
  configureArchiving(config: ArchivingConfig): Promise<void>;

  /**
   * Archive memories based on criteria
   */
  archiveMemories(criteria: PruningCriteria): Promise<MemoryOptimizationResult>;

  /**
   * Restore memories from archive
   */
  restoreMemories(archiveId: string, memoryIds?: string[]): Promise<MemoryOptimizationResult>;

  /**
   * List archived memories
   */
  listArchives(): Promise<Array<{
    id: string;
    name: string;
    memoryCount: number;
    size: number;
    createdAt: Date;
  }>>;

  /**
   * Delete archive
   */
  deleteArchive(archiveId: string): Promise<void>;

  /**
   * Get archive details
   */
  getArchiveDetails(archiveId: string): Promise<{
    id: string;
    name: string;
    memories: MemoryItem[];
    metadata: any;
    createdAt: Date;
  }>;
}

/**
 * Interface for memory backup operations
 */
export interface MemoryBackup {
  /**
   * Configure backup settings
   */
  configureBackup(config: BackupConfig): Promise<void>;

  /**
   * Create manual backup
   */
  createBackup(name?: string): Promise<{
    id: string;
    name: string;
    path: string;
    size: number;
    memoryCount: number;
    createdAt: Date;
  }>;

  /**
   * Restore from backup
   */
  restoreFromBackup(backupId: string, options?: {
    overwrite?: boolean;
    agentIds?: string[];
  }): Promise<MemoryOptimizationResult>;

  /**
   * List available backups
   */
  listBackups(): Promise<Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    memoryCount: number;
    createdAt: Date;
  }>>;

  /**
   * Delete backup
   */
  deleteBackup(backupId: string): Promise<void>;

  /**
   * Verify backup integrity
   */
  verifyBackup(backupId: string): Promise<{
    valid: boolean;
    issues: string[];
    checkedAt: Date;
  }>;

  /**
   * Start automatic backup
   */
  startAutoBackup(): Promise<void>;

  /**
   * Stop automatic backup
   */
  stopAutoBackup(): Promise<void>;
}

/**
 * Interface for memory health monitoring
 */
export interface MemoryHealthMonitor {
  /**
   * Perform comprehensive health check
   */
  performHealthCheck(agentId?: string): Promise<MemoryHealthCheck>;

  /**
   * Check memory integrity
   */
  checkIntegrity(memoryIds?: string[]): Promise<{
    validMemories: string[];
    corruptedMemories: string[];
    missingMemories: string[];
    issues: string[];
  }>;

  /**
   * Monitor memory performance
   */
  monitorPerformance(): Promise<{
    averageQueryTime: number;
    slowQueries: number;
    memoryUtilization: number;
    recommendations: string[];
  }>;

  /**
   * Get health metrics
   */
  getHealthMetrics(): Promise<MemoryMonitoringMetrics>;

  /**
   * Start continuous health monitoring
   */
  startHealthMonitoring(interval?: number): Promise<void>;

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): Promise<void>;

  /**
   * Get monitoring alerts
   */
  getAlerts(): Promise<Array<{
    id: string;
    type: 'warning' | 'critical';
    message: string;
    agentId?: string;
    memoryId?: string;
    timestamp: Date;
  }>>;
}

/**
 * Interface for memory portability operations
 */
export interface MemoryPortability {
  /**
   * Export memories to file
   */
  exportMemories(config: MemoryPortabilityConfig): Promise<MemoryExportResult>;

  /**
   * Import memories from file
   */
  importMemories(filePath: string, options?: {
    overwrite?: boolean;
    agentMapping?: Map<string, string>;
    validation?: boolean;
  }): Promise<MemoryImportResult>;

  /**
   * Get supported export formats
   */
  getSupportedFormats(): Promise<string[]>;

  /**
   * Validate import file
   */
  validateImportFile(filePath: string): Promise<{
    valid: boolean;
    format: string;
    memoryCount: number;
    issues: string[];
  }>;

  /**
   * Get export templates
   */
  getExportTemplates(): Promise<Array<{
    name: string;
    description: string;
    config: MemoryPortabilityConfig;
  }>>;
}

/**
 * Interface for memory visualization
 */
export interface MemoryVisualizer {
  /**
   * Generate memory network graph
   */
  generateNetworkGraph(agentId?: string): Promise<MemoryVisualizationData>;

  /**
   * Generate memory timeline
   */
  generateTimeline(agentId?: string, timeRange?: {
    start: Date;
    end: Date;
  }): Promise<MemoryVisualizationData>;

  /**
   * Generate memory heatmap
   */
  generateHeatmap(agentId?: string): Promise<MemoryVisualizationData>;

  /**
   * Generate memory tree structure
   */
  generateTreeStructure(agentId?: string): Promise<MemoryVisualizationData>;

  /**
   * Generate access pattern visualization
   */
  generateAccessPatternVisualization(agentId?: string): Promise<MemoryVisualizationData>;

  /**
   * Generate custom visualization
   */
  generateCustomVisualization(config: {
    type: string;
    data: any;
    options: any;
  }): Promise<MemoryVisualizationData>;

  /**
   * Export visualization
   */
  exportVisualization(visualization: MemoryVisualizationData, format: 'png' | 'svg' | 'pdf' | 'json'): Promise<string>;
}

/**
 * Interface for memory debugging tools
 */
export interface MemoryDebugger {
  /**
   * Get detailed memory information
   */
  getMemoryDebugInfo(memoryId: string): Promise<MemoryDebugInfo>;

  /**
   * Trace memory access path
   */
  traceMemoryAccess(memoryId: string): Promise<Array<{
    timestamp: Date;
    operation: string;
    agent: string;
    details: any;
  }>>;

  /**
   * Find memory inconsistencies
   */
  findInconsistencies(agentId?: string): Promise<Array<{
    memoryId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestions: string[];
  }>>;

  /**
   * Analyze memory relationships
   */
  analyzeRelationships(memoryId: string): Promise<{
    directRelations: string[];
    indirectRelations: string[];
    orphanedMemories: string[];
    relationshipStrength: Map<string, number>;
  }>;

  /**
   * Get memory dependency graph
   */
  getDependencyGraph(memoryId: string): Promise<{
    dependencies: string[];
    dependents: string[];
    graph: any;
  }>;

  /**
   * Validate memory data
   */
  validateMemoryData(memoryId: string): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }>;

  /**
   * Get debug session
   */
  startDebugSession(agentId?: string): Promise<{
    sessionId: string;
    startedAt: Date;
    configuration: any;
  }>;

  /**
   * End debug session
   */
  endDebugSession(sessionId: string): Promise<{
    sessionId: string;
    duration: number;
    findings: any[];
  }>;
}

/**
 * Main interface for memory optimization system
 */
export interface MemoryOptimizationSystem {
  /**
   * Initialize the optimization system
   */
  initialize(): Promise<void>;

  /**
   * Get memory optimizer
   */
  getOptimizer(): MemoryOptimizer;

  /**
   * Get memory analytics
   */
  getAnalytics(): MemoryAnalytics;

  /**
   * Get memory persistence
   */
  getPersistence(): MemoryPersistence;

  /**
   * Get memory backup
   */
  getBackup(): MemoryBackup;

  /**
   * Get health monitor
   */
  getHealthMonitor(): MemoryHealthMonitor;

  /**
   * Get portability manager
   */
  getPortability(): MemoryPortability;

  /**
   * Get visualizer
   */
  getVisualizer(): MemoryVisualizer;

  /**
   * Get debugger
   */
  getDebugger(): MemoryDebugger;

  /**
   * Shutdown the optimization system
   */
  shutdown(): Promise<void>;
}