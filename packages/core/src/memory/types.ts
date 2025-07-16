/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core types for the Agent Memory and Context Engine
 */

/**
 * Types of memory that agents can store and retrieve
 */
export enum MemoryType {
  /** Episodic memory - memories of specific events and experiences */
  EPISODIC = 'episodic',
  /** Semantic memory - general knowledge and facts */
  SEMANTIC = 'semantic',
  /** Procedural memory - knowledge of how to perform tasks */
  PROCEDURAL = 'procedural',
  /** Working memory - temporary information during task execution */
  WORKING = 'working',
  /** Shared memory - information shared between agents */
  SHARED = 'shared'
}

/**
 * Relevance score for memory items
 */
export enum MemoryRelevance {
  /** Critical information that should never be forgotten */
  CRITICAL = 1.0,
  /** High importance information */
  HIGH = 0.8,
  /** Medium importance information */
  MEDIUM = 0.6,
  /** Low importance information */
  LOW = 0.4,
  /** Minimal importance information */
  MINIMAL = 0.2
}

/**
 * Scope of memory access
 */
export enum MemoryScope {
  /** Private to a single agent */
  PRIVATE = 'private',
  /** Shared within a team */
  TEAM = 'team',
  /** Shared across all agents */
  GLOBAL = 'global',
  /** Session-specific memory */
  SESSION = 'session'
}

/**
 * Content type for memory items
 */
export enum MemoryContentType {
  TEXT = 'text',
  JSON = 'json',
  CODE = 'code',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  STRUCTURED = 'structured'
}

/**
 * Memory access permissions
 */
export interface MemoryPermissions {
  /** Can read this memory */
  read: string[];
  /** Can write to this memory */
  write: string[];
  /** Can delete this memory */
  delete: string[];
  /** Can share this memory */
  share: string[];
}

/**
 * Metadata associated with memory items
 */
export interface MemoryMetadata {
  /** When the memory was created */
  createdAt: Date;
  /** When the memory was last accessed */
  lastAccessedAt: Date;
  /** When the memory was last updated */
  updatedAt: Date;
  /** How many times this memory has been accessed */
  accessCount: number;
  /** Source of the memory */
  source: string;
  /** Tags for categorization */
  tags: string[];
  /** Context in which the memory was created */
  context?: Record<string, any>;
  /** Memory importance score */
  importance: number;
  /** Memory decay rate */
  decayRate: number;
  /** Embedding vector for similarity search */
  embedding?: number[];
  /** Related memory IDs */
  relatedMemories: string[];
  /** Memory permissions */
  permissions: MemoryPermissions;
}

/**
 * Core memory item structure
 */
export interface MemoryItem {
  /** Unique identifier */
  id: string;
  /** Agent ID that owns this memory */
  agentId: string;
  /** Type of memory */
  type: MemoryType;
  /** Content type */
  contentType: MemoryContentType;
  /** Memory scope */
  scope: MemoryScope;
  /** Relevance score */
  relevance: MemoryRelevance;
  /** Memory content */
  content: any;
  /** Memory metadata */
  metadata: MemoryMetadata;
  /** Current relevance score (computed) */
  currentRelevance?: number;
}

/**
 * Memory query interface
 */
export interface MemoryQuery {
  /** Agent ID to query memories for */
  agentId?: string;
  /** Memory types to include */
  types?: MemoryType[];
  /** Content types to include */
  contentTypes?: MemoryContentType[];
  /** Memory scopes to include */
  scopes?: MemoryScope[];
  /** Minimum relevance score */
  minRelevance?: number;
  /** Maximum relevance score */
  maxRelevance?: number;
  /** Text query for semantic search */
  query?: string;
  /** Tags to filter by */
  tags?: string[];
  /** Date range filter */
  dateRange?: {
    from: Date;
    to: Date;
  };
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort order */
  sortBy?: 'relevance' | 'created' | 'accessed' | 'updated';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  /** Found memory items */
  items: MemoryItem[];
  /** Total count of matching items */
  totalCount: number;
  /** Search query used */
  query: MemoryQuery;
  /** Search execution time in milliseconds */
  executionTime: number;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  /** Total number of memory items */
  totalMemories: number;
  /** Memory breakdown by type */
  byType: Record<MemoryType, number>;
  /** Memory breakdown by scope */
  byScope: Record<MemoryScope, number>;
  /** Memory breakdown by content type */
  byContentType: Record<MemoryContentType, number>;
  /** Average relevance score */
  averageRelevance: number;
  /** Most accessed memories */
  mostAccessed: MemoryItem[];
  /** Recently created memories */
  recentlyCreated: MemoryItem[];
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Performance metrics */
  performance: {
    averageQueryTime: number;
    averageStoreTime: number;
    cacheHitRate: number;
  };
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Maximum number of memories per agent */
  maxMemoriesPerAgent: number;
  /** Default memory decay rate */
  defaultDecayRate: number;
  /** Minimum relevance score for retention */
  minRelevanceThreshold: number;
  /** Memory cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Enable memory compression */
  enableCompression: boolean;
  /** Enable memory encryption */
  enableEncryption: boolean;
  /** Memory cache size */
  cacheSize: number;
  /** Vector database configuration */
  vectorDb?: {
    dimensions: number;
    metric: 'cosine' | 'euclidean' | 'dotproduct';
    indexType: string;
  };
}

/**
 * Memory operation result
 */
export interface MemoryOperationResult {
  /** Operation success status */
  success: boolean;
  /** Result message */
  message: string;
  /** Operation execution time */
  executionTime: number;
  /** Memory ID (for store operations) */
  memoryId?: string;
  /** Error details if operation failed */
  error?: Error;
}

/**
 * Context window for memory management
 */
export interface ContextWindow {
  /** Window size in number of items */
  size: number;
  /** Current items in the window */
  items: MemoryItem[];
  /** Window relevance threshold */
  relevanceThreshold: number;
  /** Last update time */
  lastUpdated: Date;
}

/**
 * Memory chunk for large content
 */
export interface MemoryChunk {
  /** Chunk identifier */
  id: string;
  /** Parent memory ID */
  parentId: string;
  /** Chunk index */
  index: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Chunk content */
  content: any;
  /** Chunk metadata */
  metadata: {
    size: number;
    checksum: string;
    encoding: string;
  };
}