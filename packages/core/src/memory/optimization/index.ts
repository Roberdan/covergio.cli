/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export * from './types.js';

// Interfaces
export * from './interfaces.js';

// Core implementations
export { DefaultMemoryOptimizer } from './MemoryOptimizer.js';
export { DefaultMemoryAnalytics } from './MemoryAnalytics.js';
export { DefaultMemoryPersistence } from './MemoryPersistence.js';
export { DefaultMemoryBackup } from './MemoryBackup.js';
export { DefaultMemoryHealthMonitor } from './MemoryHealthMonitor.js';
export { DefaultMemoryPortability } from './MemoryPortability.js';
export { DefaultMemoryVisualizer } from './MemoryVisualizer.js';
export { DefaultMemoryDebugger } from './MemoryDebugger.js';

// Main system
export { DefaultMemoryOptimizationSystem } from './MemoryOptimizationSystem.js';

// Re-export for convenience
export {
  MemoryOptimizer,
  MemoryAnalytics,
  MemoryPersistence,
  MemoryBackup,
  MemoryHealthMonitor,
  MemoryPortability,
  MemoryVisualizer,
  MemoryDebugger,
  MemoryOptimizationSystem
} from './interfaces.js';

export {
  MemoryOptimizationConfig,
  MemoryOptimizationResult,
  MemoryUsageAnalytics,
  OptimizationStrategy,
  ConsolidationRule,
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