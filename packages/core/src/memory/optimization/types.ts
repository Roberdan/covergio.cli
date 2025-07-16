/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryItem } from '../types.js';

/**
 * Memory optimization configuration
 */
export interface MemoryOptimizationConfig {
  /** Maximum memory items per agent */
  maxMemoriesPerAgent: number;
  /** Memory pruning threshold (0-1) */
  pruningThreshold: number;
  /** Consolidation interval in milliseconds */
  consolidationInterval: number;
  /** Minimum relevance score for retention */
  minRelevanceScore: number;
  /** Maximum age in milliseconds before archiving */
  maxAgeBeforeArchiving: number;
  /** Enable automatic optimization */
  enableAutoOptimization: boolean;
  /** Optimization strategy */
  strategy: OptimizationStrategy;
}

/**
 * Optimization strategies
 */
export enum OptimizationStrategy {
  RELEVANCE_BASED = 'relevance_based',
  TIME_BASED = 'time_based',
  FREQUENCY_BASED = 'frequency_based',
  HYBRID = 'hybrid'
}

/**
 * Memory optimization result
 */
export interface MemoryOptimizationResult {
  /** Operation success */
  success: boolean;
  /** Result message */
  message: string;
  /** Number of memories processed */
  memoriesProcessed: number;
  /** Number of memories pruned */
  memoriesPruned: number;
  /** Number of memories consolidated */
  memoriesConsolidated: number;
  /** Number of memories archived */
  memoriesArchived: number;
  /** Optimization duration */
  duration: number;
  /** Memory usage before optimization */
  memoryUsageBefore: number;
  /** Memory usage after optimization */
  memoryUsageAfter: number;
  /** Error if any */
  error?: Error;
}

/**
 * Memory consolidation rule
 */
export interface ConsolidationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Condition function */
  condition: (memories: MemoryItem[]) => boolean;
  /** Action function */
  action: (memories: MemoryItem[]) => MemoryItem;
  /** Priority (higher = more important) */
  priority: number;
  /** Enabled status */
  enabled: boolean;
}

/**
 * Memory usage analytics
 */
export interface MemoryUsageAnalytics {
  /** Total memory count */
  totalMemories: number;
  /** Memory distribution by type */
  memoryByType: Map<string, number>;
  /** Memory distribution by agent */
  memoryByAgent: Map<string, number>;
  /** Average memory size */
  averageMemorySize: number;
  /** Total memory usage in bytes */
  totalMemoryUsage: number;
  /** Most accessed memories */
  mostAccessedMemories: MemoryItem[];
  /** Least accessed memories */
  leastAccessedMemories: MemoryItem[];
  /** Memory age distribution */
  ageDistribution: {
    lessThanDay: number;
    lessThanWeek: number;
    lessThanMonth: number;
    moreThanMonth: number;
  };
  /** Memory access patterns */
  accessPatterns: {
    peakAccessTime: string;
    averageAccessFrequency: number;
    mostActiveAgents: string[];
  };
  /** Performance metrics */
  performance: {
    averageQueryTime: number;
    averageStoreTime: number;
    cacheHitRate: number;
  };
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Recently created memories */
  recentlyCreated: MemoryItem[];
}

/**
 * Memory pruning criteria
 */
export interface PruningCriteria {
  /** Minimum relevance score */
  minRelevanceScore?: number;
  /** Maximum age in milliseconds */
  maxAge?: number;
  /** Minimum access count */
  minAccessCount?: number;
  /** Maximum last accessed time */
  maxLastAccessedTime?: number;
  /** Memory types to exclude from pruning */
  excludeTypes?: string[];
  /** Agent IDs to exclude from pruning */
  excludeAgents?: string[];
  /** Custom filter function */
  customFilter?: (memory: MemoryItem) => boolean;
}

/**
 * Memory archiving configuration
 */
export interface ArchivingConfig {
  /** Archive storage path */
  storagePath: string;
  /** Compression enabled */
  enableCompression: boolean;
  /** Encryption enabled */
  enableEncryption: boolean;
  /** Archive format */
  format: 'json' | 'binary' | 'compressed';
  /** Retention period in milliseconds */
  retentionPeriod: number;
  /** Auto-archive enabled */
  enableAutoArchive: boolean;
  /** Archive batch size */
  batchSize: number;
}

/**
 * Memory backup configuration
 */
export interface BackupConfig {
  /** Backup storage path */
  storagePath: string;
  /** Backup frequency in milliseconds */
  frequency: number;
  /** Number of backups to retain */
  retainCount: number;
  /** Incremental backup enabled */
  enableIncremental: boolean;
  /** Compression enabled */
  enableCompression: boolean;
  /** Encryption enabled */
  enableEncryption: boolean;
  /** Backup format */
  format: 'json' | 'binary' | 'sql';
}

/**
 * Memory health check result
 */
export interface MemoryHealthCheck {
  /** Overall health status */
  status: 'healthy' | 'warning' | 'critical';
  /** Health score (0-100) */
  score: number;
  /** Individual check results */
  checks: {
    /** Memory integrity */
    integrity: HealthCheckResult;
    /** Performance metrics */
    performance: HealthCheckResult;
    /** Storage utilization */
    storage: HealthCheckResult;
    /** Access patterns */
    accessPatterns: HealthCheckResult;
    /** Memory distribution */
    distribution: HealthCheckResult;
  };
  /** Recommendations */
  recommendations: string[];
  /** Check timestamp */
  checkedAt: Date;
}

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  /** Check status */
  status: 'pass' | 'warning' | 'fail';
  /** Check score (0-100) */
  score: number;
  /** Check message */
  message: string;
  /** Detailed metrics */
  metrics: Record<string, any>;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Memory export/import configuration
 */
export interface MemoryPortabilityConfig {
  /** Export format */
  format: 'json' | 'csv' | 'xml' | 'binary';
  /** Include metadata */
  includeMetadata: boolean;
  /** Include embeddings */
  includeEmbeddings: boolean;
  /** Include relationships */
  includeRelationships: boolean;
  /** Compression enabled */
  enableCompression: boolean;
  /** Encryption enabled */
  enableEncryption: boolean;
  /** Filter criteria */
  filter?: {
    agentIds?: string[];
    memoryTypes?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

/**
 * Memory export result
 */
export interface MemoryExportResult {
  /** Export success */
  success: boolean;
  /** Export path */
  exportPath: string;
  /** Number of memories exported */
  memoriesExported: number;
  /** Export size in bytes */
  exportSize: number;
  /** Export duration */
  duration: number;
  /** Export format */
  format: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Error if any */
  error?: Error;
}

/**
 * Memory import result
 */
export interface MemoryImportResult {
  /** Import success */
  success: boolean;
  /** Number of memories imported */
  memoriesImported: number;
  /** Number of memories skipped */
  memoriesSkipped: number;
  /** Import duration */
  duration: number;
  /** Import conflicts */
  conflicts: string[];
  /** Import timestamp */
  importedAt: Date;
  /** Error if any */
  error?: Error;
}

/**
 * Memory visualization data
 */
export interface MemoryVisualizationData {
  /** Visualization type */
  type: 'graph' | 'timeline' | 'heatmap' | 'tree' | 'network';
  /** Visualization data */
  data: any;
  /** Visualization metadata */
  metadata: {
    title: string;
    description: string;
    generatedAt: Date;
    agentIds: string[];
    memoryCount: number;
  };
  /** Visualization configuration */
  config: {
    width: number;
    height: number;
    interactive: boolean;
    theme: 'light' | 'dark';
    layout: string;
  };
}

/**
 * Memory debugging information
 */
export interface MemoryDebugInfo {
  /** Memory item */
  memory: MemoryItem;
  /** Access history */
  accessHistory: {
    accessedAt: Date;
    accessedBy: string;
    operation: string;
  }[];
  /** Modification history */
  modificationHistory: {
    modifiedAt: Date;
    modifiedBy: string;
    changes: Record<string, any>;
  }[];
  /** Relationships */
  relationships: {
    related: string[];
    references: string[];
    referencedBy: string[];
  };
  /** Performance metrics */
  performance: {
    retrievalTime: number;
    storageSize: number;
    compressionRatio: number;
  };
  /** Health indicators */
  health: {
    integrity: boolean;
    consistency: boolean;
    accessibility: boolean;
  };
}

/**
 * Memory monitoring metrics
 */
export interface MemoryMonitoringMetrics {
  /** Current memory count */
  currentMemoryCount: number;
  /** Memory growth rate */
  memoryGrowthRate: number;
  /** Average access frequency */
  averageAccessFrequency: number;
  /** Storage utilization */
  storageUtilization: number;
  /** Query performance */
  queryPerformance: {
    averageQueryTime: number;
    slowQueryCount: number;
    queryThroughput: number;
  };
  /** Memory operations */
  operations: {
    storeOperations: number;
    retrieveOperations: number;
    updateOperations: number;
    deleteOperations: number;
  };
  /** Error rates */
  errorRates: {
    storageErrors: number;
    retrievalErrors: number;
    corruptionErrors: number;
  };
  /** Timestamp */
  timestamp: Date;
}