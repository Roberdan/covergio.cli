/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-Agent Memory Sharing and Context Management
 * 
 * This module provides comprehensive cross-agent memory sharing capabilities,
 * including memory pools, context merging, collaboration sessions, and
 * cross-agent querying with permission management.
 */

// Core types and interfaces
export * from './types.js';
export * from './interfaces.js';

// Core implementations
export { DefaultMemoryShareManager } from './MemoryShareManager.js';
export { DefaultCrossAgentMemoryManager } from './CrossAgentMemoryManager.js';
export { DefaultSharedMemoryPoolManager } from './SharedMemoryPoolManager.js';
export { DefaultContextMerger } from './ContextMerger.js';
export { DefaultCrossAgentQueryEngine } from './CrossAgentQueryEngine.js';
export { DefaultCollaborationSessionManager } from './CollaborationSessionManager.js';

// Re-export commonly used types for convenience
export type {
  MemorySharingRequest,
  MemorySharingResult,
  SharedMemoryPool,
  SharedMemoryItem,
  MergedContext,
  ContextMergeConfig,
  CrossAgentQuery,
  CrossAgentQueryResult,
  AgentCollaborationSession,
  MemorySharingStats,
  MemoryConflict,
  MemoryProvenance
} from './types.js';

export {
  MemoryPermission,
  SharingScope,
  SharingStatus,
  ConflictResolution
} from './types.js';

// Re-export key interfaces
export type {
  MemoryShareManager,
  CrossAgentMemoryManager,
  SharedMemoryPoolManager,
  ContextMerger,
  CrossAgentQueryEngine,
  CollaborationSessionManager,
  MemorySynchronizer,
  MemoryAccessController,
  MemoryProvenanceTracker,
  AgentIsolationManager
} from './interfaces.js';