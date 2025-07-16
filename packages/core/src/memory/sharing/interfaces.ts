/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MemorySharingRequest,
  MemorySharingPolicy,
  SharedMemoryPool,
  SharedMemoryItem,
  MemorySyncEvent,
  ContextMergeConfig,
  MergedContext,
  AgentContextIsolation,
  MemoryProvenance,
  MemorySyncStatus,
  MemoryConflict,
  CrossAgentQuery,
  CrossAgentQueryResult,
  MemorySharingResult,
  MemorySharingStats,
  AgentCollaborationSession,
  MemoryPermission,
  SharingScope,
  ConflictResolution
} from './types.js';
import { MemoryItem } from '../types.js';

/**
 * Interface for memory sharing management
 */
export interface MemoryShareManager {
  /**
   * Share memory with other agents
   */
  shareMemory(
    memoryId: string,
    fromAgent: string,
    toAgents: string[],
    permissions: MemoryPermission[],
    scope?: SharingScope,
    expiresAt?: Date
  ): Promise<MemorySharingResult>;

  /**
   * Unshare memory from agents
   */
  unshareMemory(
    memoryId: string,
    fromAgent: string,
    targetAgents: string[]
  ): Promise<MemorySharingResult>;

  /**
   * Check if agent has permission to access memory
   */
  checkPermissions(
    memoryId: string,
    agentId: string,
    permission: MemoryPermission
  ): Promise<boolean>;

  /**
   * Get shared memories for an agent
   */
  getSharedMemories(agentId: string): Promise<SharedMemoryItem[]>;

  /**
   * Update memory permissions
   */
  updatePermissions(
    memoryId: string,
    permissions: Map<string, MemoryPermission[]>
  ): Promise<MemorySharingResult>;

  /**
   * Get sharing history for a memory
   */
  getSharingHistory(memoryId: string): Promise<any[]>;

  /**
   * Create sharing request
   */
  createSharingRequest(request: Omit<MemorySharingRequest, 'id' | 'requestedAt' | 'status'>): Promise<MemorySharingRequest>;

  /**
   * Approve sharing request
   */
  approveSharingRequest(requestId: string, approvingAgent: string): Promise<MemorySharingResult>;

  /**
   * Reject sharing request
   */
  rejectSharingRequest(requestId: string, rejectingAgent: string, reason?: string): Promise<MemorySharingResult>;
}

/**
 * Interface for shared memory pool management
 */
export interface SharedMemoryPoolManager {
  /**
   * Create a new shared memory pool
   */
  createPool(
    name: string,
    owner: string,
    participants: string[],
    policies?: MemorySharingPolicy[]
  ): Promise<SharedMemoryPool>;

  /**
   * Delete a memory pool
   */
  deletePool(poolId: string, deletingAgent: string): Promise<MemorySharingResult>;

  /**
   * Add agent to pool
   */
  addAgentToPool(
    poolId: string,
    agentId: string,
    permissions: MemoryPermission[]
  ): Promise<MemorySharingResult>;

  /**
   * Remove agent from pool
   */
  removeAgentFromPool(poolId: string, agentId: string): Promise<MemorySharingResult>;

  /**
   * Add memory to pool
   */
  addMemoryToPool(
    poolId: string,
    memoryId: string,
    addingAgent: string
  ): Promise<MemorySharingResult>;

  /**
   * Remove memory from pool
   */
  removeMemoryFromPool(
    poolId: string,
    memoryId: string,
    removingAgent: string
  ): Promise<MemorySharingResult>;

  /**
   * Get pool by ID
   */
  getPool(poolId: string): Promise<SharedMemoryPool | null>;

  /**
   * List pools for agent
   */
  listPoolsForAgent(agentId: string): Promise<SharedMemoryPool[]>;

  /**
   * Update pool policies
   */
  updatePoolPolicies(
    poolId: string,
    policies: MemorySharingPolicy[]
  ): Promise<MemorySharingResult>;
}

/**
 * Interface for memory synchronization
 */
export interface MemorySynchronizer {
  /**
   * Synchronize memory across agents
   */
  synchronizeMemory(
    memoryId: string,
    agents: string[]
  ): Promise<MemorySharingResult>;

  /**
   * Handle synchronization event
   */
  handleSyncEvent(event: MemorySyncEvent): Promise<void>;

  /**
   * Get synchronization status
   */
  getSyncStatus(memoryId: string): Promise<MemorySyncStatus>;

  /**
   * Resolve memory conflicts
   */
  resolveConflicts(
    memoryId: string,
    conflicts: MemoryConflict[],
    resolution: ConflictResolution
  ): Promise<MemorySharingResult>;

  /**
   * Start continuous synchronization
   */
  startContinuousSync(memoryId: string, agents: string[]): Promise<void>;

  /**
   * Stop continuous synchronization
   */
  stopContinuousSync(memoryId: string): Promise<void>;
}

/**
 * Interface for context merging
 */
export interface ContextMerger {
  /**
   * Merge contexts from multiple agents
   */
  mergeContexts(
    agentIds: string[],
    config: ContextMergeConfig
  ): Promise<MergedContext>;

  /**
   * Merge specific memories
   */
  mergeMemories(
    memories: MemoryItem[],
    config: ContextMergeConfig
  ): Promise<MergedContext>;

  /**
   * Resolve context conflicts
   */
  resolveContextConflicts(
    conflicts: MemoryConflict[],
    resolution: ConflictResolution
  ): Promise<MemoryItem[]>;

  /**
   * Calculate context similarity
   */
  calculateContextSimilarity(
    context1: MemoryItem[],
    context2: MemoryItem[]
  ): Promise<number>;

  /**
   * Optimize merged context
   */
  optimizeMergedContext(
    context: MergedContext,
    maxSize?: number
  ): Promise<MergedContext>;
}

/**
 * Interface for memory access control
 */
export interface MemoryAccessController {
  /**
   * Set memory permissions
   */
  setPermissions(
    memoryId: string,
    permissions: Map<string, MemoryPermission[]>
  ): Promise<MemorySharingResult>;

  /**
   * Check access permission
   */
  checkAccess(
    memoryId: string,
    agentId: string,
    permission: MemoryPermission
  ): Promise<boolean>;

  /**
   * Grant temporary access
   */
  grantTemporaryAccess(
    memoryId: string,
    agentId: string,
    permissions: MemoryPermission[],
    duration: number
  ): Promise<MemorySharingResult>;

  /**
   * Revoke access
   */
  revokeAccess(
    memoryId: string,
    agentId: string,
    permissions?: MemoryPermission[]
  ): Promise<MemorySharingResult>;

  /**
   * Get agent permissions
   */
  getAgentPermissions(memoryId: string, agentId: string): Promise<MemoryPermission[]>;

  /**
   * List accessible memories
   */
  listAccessibleMemories(
    agentId: string,
    permission: MemoryPermission
  ): Promise<string[]>;
}

/**
 * Interface for memory provenance tracking
 */
export interface MemoryProvenanceTracker {
  /**
   * Track memory creation
   */
  trackCreation(memoryId: string, creator: string): Promise<void>;

  /**
   * Track memory modification
   */
  trackModification(
    memoryId: string,
    modifier: string,
    changeDescription?: string
  ): Promise<void>;

  /**
   * Track memory sharing
   */
  trackSharing(
    memoryId: string,
    sharer: string,
    targetAgents: string[]
  ): Promise<void>;

  /**
   * Get memory provenance
   */
  getProvenance(memoryId: string): Promise<MemoryProvenance | null>;

  /**
   * Verify memory integrity
   */
  verifyIntegrity(memoryId: string): Promise<boolean>;

  /**
   * Get modification history
   */
  getModificationHistory(memoryId: string): Promise<any[]>;
}

/**
 * Interface for agent isolation management
 */
export interface AgentIsolationManager {
  /**
   * Set agent isolation policy
   */
  setIsolationPolicy(
    agentId: string,
    isolation: AgentContextIsolation
  ): Promise<MemorySharingResult>;

  /**
   * Get agent isolation settings
   */
  getIsolationSettings(agentId: string): Promise<AgentContextIsolation | null>;

  /**
   * Check if sharing is allowed
   */
  isSharingAllowed(
    fromAgent: string,
    toAgent: string,
    memoryType: string,
    scope: SharingScope
  ): Promise<boolean>;

  /**
   * Filter accessible memories
   */
  filterAccessibleMemories(
    agentId: string,
    memories: MemoryItem[]
  ): Promise<MemoryItem[]>;

  /**
   * Update isolation rules
   */
  updateIsolationRules(
    agentId: string,
    rules: Partial<AgentContextIsolation>
  ): Promise<MemorySharingResult>;
}

/**
 * Interface for cross-agent querying
 */
export interface CrossAgentQueryEngine {
  /**
   * Execute cross-agent query
   */
  executeQuery(query: CrossAgentQuery): Promise<CrossAgentQueryResult>;

  /**
   * Query multiple agents
   */
  queryAgents(
    requestingAgent: string,
    targetAgents: string[],
    query: any,
    requiredPermissions: MemoryPermission[]
  ): Promise<CrossAgentQueryResult>;

  /**
   * Aggregate query results
   */
  aggregateResults(
    results: Map<string, MemoryItem[]>,
    aggregationType: 'union' | 'intersection' | 'weighted'
  ): Promise<MemoryItem[]>;

  /**
   * Get query history
   */
  getQueryHistory(agentId: string): Promise<CrossAgentQuery[]>;
}

/**
 * Interface for collaboration session management
 */
export interface CollaborationSessionManager {
  /**
   * Create collaboration session
   */
  createSession(
    name: string,
    participants: string[],
    leader: string,
    policies?: MemorySharingPolicy[]
  ): Promise<AgentCollaborationSession>;

  /**
   * Join collaboration session
   */
  joinSession(sessionId: string, agentId: string): Promise<MemorySharingResult>;

  /**
   * Leave collaboration session
   */
  leaveSession(sessionId: string, agentId: string): Promise<MemorySharingResult>;

  /**
   * Update shared context
   */
  updateSharedContext(
    sessionId: string,
    updatingAgent: string,
    memories: MemoryItem[]
  ): Promise<MemorySharingResult>;

  /**
   * Get session context
   */
  getSessionContext(sessionId: string): Promise<MergedContext | null>;

  /**
   * End collaboration session
   */
  endSession(sessionId: string, endingAgent: string): Promise<MemorySharingResult>;

  /**
   * List active sessions for agent
   */
  listActiveSessions(agentId: string): Promise<AgentCollaborationSession[]>;
}

/**
 * Main interface for cross-agent memory operations
 */
export interface CrossAgentMemoryManager {
  /**
   * Initialize the cross-agent memory system
   */
  initialize(): Promise<void>;

  /**
   * Share memory between agents
   */
  shareMemory(
    memoryId: string,
    fromAgent: string,
    toAgents: string[],
    permissions: MemoryPermission[],
    options?: {
      scope?: SharingScope;
      expiresAt?: Date;
      message?: string;
    }
  ): Promise<MemorySharingResult>;

  /**
   * Create shared memory pool
   */
  createSharedPool(
    name: string,
    owner: string,
    participants: string[],
    policies?: MemorySharingPolicy[]
  ): Promise<SharedMemoryPool>;

  /**
   * Merge agent contexts
   */
  mergeAgentContexts(
    agentIds: string[],
    config: ContextMergeConfig
  ): Promise<MergedContext>;

  /**
   * Query across multiple agents
   */
  crossAgentQuery(
    requestingAgent: string,
    targetAgents: string[],
    query: any,
    requiredPermissions: MemoryPermission[]
  ): Promise<CrossAgentQueryResult>;

  /**
   * Start collaboration session
   */
  startCollaboration(
    name: string,
    participants: string[],
    leader: string
  ): Promise<AgentCollaborationSession>;

  /**
   * Get sharing statistics
   */
  getSharingStats(): Promise<MemorySharingStats>;

  /**
   * Cleanup expired sharing sessions
   */
  cleanup(): Promise<void>;

  /**
   * Shutdown the cross-agent system
   */
  shutdown(): Promise<void>;
}