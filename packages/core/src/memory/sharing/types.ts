/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemoryItem } from '../types.js';

/**
 * Cross-agent memory sharing types and interfaces
 */

/**
 * Memory sharing permissions
 */
export enum MemoryPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  SHARE = 'share',
  ADMIN = 'admin'
}

/**
 * Memory sharing scope
 */
export enum SharingScope {
  PRIVATE = 'private',
  TEAM = 'team',
  GROUP = 'group',
  GLOBAL = 'global',
  TEMPORARY = 'temporary'
}

/**
 * Memory sharing status
 */
export enum SharingStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended'
}

/**
 * Memory conflict resolution strategy
 */
export enum ConflictResolution {
  LATEST_WINS = 'latest_wins',
  OLDEST_WINS = 'oldest_wins',
  MERGE = 'merge',
  MANUAL = 'manual',
  PRIORITY = 'priority'
}

/**
 * Memory sharing request
 */
export interface MemorySharingRequest {
  /** Request ID */
  id: string;
  /** Memory ID to share */
  memoryId: string;
  /** Agent requesting to share */
  fromAgent: string;
  /** Target agents */
  toAgents: string[];
  /** Permissions to grant */
  permissions: MemoryPermission[];
  /** Sharing scope */
  scope: SharingScope;
  /** Expiration time */
  expiresAt?: Date;
  /** Request message */
  message?: string;
  /** Request timestamp */
  requestedAt: Date;
  /** Current status */
  status: SharingStatus;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Memory sharing policy
 */
export interface MemorySharingPolicy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Agent or group this policy applies to */
  scope: string;
  /** Default permissions */
  defaultPermissions: MemoryPermission[];
  /** Allowed sharing scopes */
  allowedScopes: SharingScope[];
  /** Maximum sharing duration */
  maxDuration?: number;
  /** Requires approval */
  requiresApproval: boolean;
  /** Auto-expire after inactivity */
  autoExpire: boolean;
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolution;
  /** Policy metadata */
  metadata?: Record<string, any>;
}

/**
 * Shared memory pool
 */
export interface SharedMemoryPool {
  /** Pool ID */
  id: string;
  /** Pool name */
  name: string;
  /** Pool description */
  description?: string;
  /** Owner agent */
  owner: string;
  /** Participating agents */
  participants: string[];
  /** Pool permissions */
  permissions: Map<string, MemoryPermission[]>;
  /** Pool policies */
  policies: MemorySharingPolicy[];
  /** Memory items in pool */
  memories: Map<string, SharedMemoryItem>;
  /** Pool metadata */
  metadata: SharedMemoryPoolMetadata;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Shared memory item
 */
export interface SharedMemoryItem extends MemoryItem {
  /** Original owner */
  originalOwner: string;
  /** Sharing history */
  sharingHistory: MemorySharingHistory[];
  /** Current permissions per agent */
  agentPermissions: Map<string, MemoryPermission[]>;
  /** Sharing metadata */
  sharingMetadata: SharedMemoryMetadata;
}

/**
 * Memory sharing history entry
 */
export interface MemorySharingHistory {
  /** History entry ID */
  id: string;
  /** Action performed */
  action: 'shared' | 'unshared' | 'modified' | 'accessed';
  /** Agent who performed action */
  agent: string;
  /** Target agents (for share/unshare) */
  targetAgents?: string[];
  /** Permissions involved */
  permissions?: MemoryPermission[];
  /** Timestamp */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Shared memory metadata
 */
export interface SharedMemoryMetadata {
  /** Share count */
  shareCount: number;
  /** Last shared timestamp */
  lastShared?: Date;
  /** Access count per agent */
  accessCount: Map<string, number>;
  /** Modification count per agent */
  modificationCount: Map<string, number>;
  /** Sharing expiration */
  expiresAt?: Date;
  /** Sharing restrictions */
  restrictions?: string[];
}

/**
 * Shared memory pool metadata
 */
export interface SharedMemoryPoolMetadata {
  /** Pool size */
  size: number;
  /** Total memory count */
  memoryCount: number;
  /** Activity statistics */
  activityStats: Map<string, number>;
  /** Pool tags */
  tags: string[];
  /** Pool category */
  category?: string;
  /** Pool priority */
  priority: number;
}

/**
 * Memory synchronization event
 */
export interface MemorySyncEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'create' | 'update' | 'delete' | 'share' | 'unshare';
  /** Memory ID */
  memoryId: string;
  /** Agent who triggered event */
  agent: string;
  /** Target agents */
  targetAgents?: string[];
  /** Event payload */
  payload: any;
  /** Timestamp */
  timestamp: Date;
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Context merge configuration
 */
export interface ContextMergeConfig {
  /** Merge strategy */
  strategy: 'union' | 'intersection' | 'priority' | 'weighted';
  /** Weight per agent (for weighted merge) */
  weights?: Map<string, number>;
  /** Priority order (for priority merge) */
  priorityOrder?: string[];
  /** Conflict resolution */
  conflictResolution: ConflictResolution;
  /** Maximum merged context size */
  maxSize?: number;
  /** Merge metadata */
  metadata?: Record<string, any>;
}

/**
 * Merged context result
 */
export interface MergedContext {
  /** Merged memory items */
  memories: MemoryItem[];
  /** Contributing agents */
  contributors: string[];
  /** Merge statistics */
  mergeStats: {
    totalMemories: number;
    duplicatesRemoved: number;
    conflictsResolved: number;
    mergeDuration: number;
  };
  /** Merge configuration used */
  config: ContextMergeConfig;
  /** Merge timestamp */
  mergedAt: Date;
  /** Merge metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent context isolation
 */
export interface AgentContextIsolation {
  /** Agent ID */
  agentId: string;
  /** Isolation level */
  isolationLevel: 'strict' | 'partial' | 'none';
  /** Restricted memory types */
  restrictedTypes: string[];
  /** Allowed sharing scopes */
  allowedScopes: SharingScope[];
  /** Blacklisted agents */
  blacklistedAgents: string[];
  /** Whitelisted agents */
  whitelistedAgents: string[];
  /** Isolation policies */
  policies: string[];
  /** Isolation metadata */
  metadata?: Record<string, any>;
}

/**
 * Memory provenance tracking
 */
export interface MemoryProvenance {
  /** Memory ID */
  memoryId: string;
  /** Original creator */
  originalCreator: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Modification chain */
  modificationChain: ProvenanceEntry[];
  /** Current version */
  currentVersion: number;
  /** Provenance metadata */
  metadata?: Record<string, any>;
}

/**
 * Provenance entry
 */
export interface ProvenanceEntry {
  /** Entry ID */
  id: string;
  /** Agent who made change */
  agent: string;
  /** Version number */
  version: number;
  /** Change type */
  changeType: 'create' | 'update' | 'delete' | 'share' | 'merge';
  /** Change description */
  description?: string;
  /** Previous hash */
  previousHash?: string;
  /** Current hash */
  currentHash: string;
  /** Timestamp */
  timestamp: Date;
  /** Change metadata */
  metadata?: Record<string, any>;
}

/**
 * Memory synchronization status
 */
export interface MemorySyncStatus {
  /** Memory ID */
  memoryId: string;
  /** Sync status */
  status: 'synced' | 'pending' | 'conflict' | 'failed';
  /** Last sync timestamp */
  lastSync?: Date;
  /** Sync attempts */
  syncAttempts: number;
  /** Conflict details */
  conflicts?: MemoryConflict[];
  /** Sync metadata */
  metadata?: Record<string, any>;
}

/**
 * Memory conflict
 */
export interface MemoryConflict {
  /** Conflict ID */
  id: string;
  /** Memory ID */
  memoryId: string;
  /** Conflicting agents */
  agents: string[];
  /** Conflict type */
  type: 'content' | 'permissions' | 'metadata' | 'timing';
  /** Conflict description */
  description: string;
  /** Conflict values */
  values: Map<string, any>;
  /** Resolution strategy */
  resolutionStrategy?: ConflictResolution;
  /** Resolved value */
  resolvedValue?: any;
  /** Conflict timestamp */
  timestamp: Date;
  /** Resolution timestamp */
  resolvedAt?: Date;
  /** Conflict metadata */
  metadata?: Record<string, any>;
}

/**
 * Cross-agent query
 */
export interface CrossAgentQuery {
  /** Query ID */
  id: string;
  /** Requesting agent */
  requestingAgent: string;
  /** Target agents */
  targetAgents: string[];
  /** Query parameters */
  query: any;
  /** Required permissions */
  requiredPermissions: MemoryPermission[];
  /** Query scope */
  scope: SharingScope;
  /** Query timestamp */
  timestamp: Date;
  /** Query metadata */
  metadata?: Record<string, any>;
}

/**
 * Cross-agent query result
 */
export interface CrossAgentQueryResult {
  /** Query ID */
  queryId: string;
  /** Results per agent */
  results: Map<string, MemoryItem[]>;
  /** Total result count */
  totalCount: number;
  /** Query execution time */
  executionTime: number;
  /** Access granted agents */
  accessGranted: string[];
  /** Access denied agents */
  accessDenied: string[];
  /** Query metadata */
  metadata?: Record<string, any>;
}

/**
 * Memory sharing operation result
 */
export interface MemorySharingResult {
  /** Operation success */
  success: boolean;
  /** Result message */
  message: string;
  /** Operation type */
  operation: string;
  /** Affected memory IDs */
  memoryIds: string[];
  /** Affected agents */
  agents: string[];
  /** Operation duration */
  duration: number;
  /** Operation metadata */
  metadata?: Record<string, any>;
  /** Error details */
  error?: Error;
}

/**
 * Memory sharing statistics
 */
export interface MemorySharingStats {
  /** Total shared memories */
  totalSharedMemories: number;
  /** Active sharing sessions */
  activeSharingSessions: number;
  /** Sharing requests pending */
  pendingRequests: number;
  /** Memory pools count */
  memoryPoolsCount: number;
  /** Cross-agent queries count */
  crossAgentQueries: number;
  /** Conflict resolution count */
  conflictsResolved: number;
  /** Average sharing duration */
  averageSharingDuration: number;
  /** Most active agents */
  mostActiveAgents: string[];
  /** Sharing success rate */
  sharingSuccessRate: number;
  /** Statistics timestamp */
  timestamp: Date;
}

/**
 * Agent collaboration session
 */
export interface AgentCollaborationSession {
  /** Session ID */
  id: string;
  /** Session name */
  name: string;
  /** Participating agents */
  participants: string[];
  /** Session leader */
  leader: string;
  /** Shared context */
  sharedContext: MergedContext;
  /** Session policies */
  policies: MemorySharingPolicy[];
  /** Session status */
  status: 'active' | 'paused' | 'ended';
  /** Session metadata */
  metadata: {
    purpose: string;
    duration: number;
    memoryUpdates: number;
    collaborationScore: number;
  };
  /** Session start time */
  startedAt: Date;
  /** Session end time */
  endedAt?: Date;
}