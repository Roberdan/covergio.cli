/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  CrossAgentMemoryManager,
  MemoryShareManager,
  SharedMemoryPoolManager,
  ContextMerger,
  CrossAgentQueryEngine,
  CollaborationSessionManager
} from './interfaces.js';
import {
  MemoryPermission,
  SharingScope,
  MemorySharingResult,
  SharedMemoryPool,
  MemorySharingPolicy,
  MergedContext,
  ContextMergeConfig,
  CrossAgentQueryResult,
  AgentCollaborationSession,
  MemorySharingStats
} from './types.js';
import { MemoryStore } from '../interfaces.js';
import { DefaultMemoryShareManager } from './MemoryShareManager.js';
import { DefaultSharedMemoryPoolManager } from './SharedMemoryPoolManager.js';
import { DefaultContextMerger } from './ContextMerger.js';
import { DefaultCrossAgentQueryEngine } from './CrossAgentQueryEngine.js';
import { DefaultCollaborationSessionManager } from './CollaborationSessionManager.js';

/**
 * Main interface for cross-agent memory operations
 */
export class DefaultCrossAgentMemoryManager implements CrossAgentMemoryManager {
  private memoryStore: MemoryStore;
  private shareManager: MemoryShareManager;
  private poolManager: SharedMemoryPoolManager;
  private contextMerger: ContextMerger;
  private queryEngine: CrossAgentQueryEngine;
  private sessionManager: CollaborationSessionManager;
  private initialized = false;

  // Statistics tracking
  private stats: MemorySharingStats = {
    totalSharedMemories: 0,
    activeSharingSessions: 0,
    pendingRequests: 0,
    memoryPoolsCount: 0,
    crossAgentQueries: 0,
    conflictsResolved: 0,
    averageSharingDuration: 0,
    mostActiveAgents: [],
    sharingSuccessRate: 0,
    timestamp: new Date()
  };

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
    this.shareManager = new DefaultMemoryShareManager(memoryStore);
    this.poolManager = new DefaultSharedMemoryPoolManager(memoryStore, this.shareManager);
    this.contextMerger = new DefaultContextMerger(memoryStore);
    this.queryEngine = new DefaultCrossAgentQueryEngine(memoryStore, this.shareManager);
    this.sessionManager = new DefaultCollaborationSessionManager(
      memoryStore,
      this.shareManager,
      this.contextMerger
    );
  }

  /**
   * Initialize the cross-agent memory system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all components
      await this.initializeComponents();
      
      // Start cleanup timer
      this.startCleanupTimer();
      
      this.initialized = true;
      
      // Update stats
      this.stats.timestamp = new Date();
      
    } catch (error) {
      throw new Error(`Failed to initialize cross-agent memory system: ${(error as Error).message}`);
    }
  }

  /**
   * Share memory between agents
   */
  async shareMemory(
    memoryId: string,
    fromAgent: string,
    toAgents: string[],
    permissions: MemoryPermission[],
    options: {
      scope?: SharingScope;
      expiresAt?: Date;
      message?: string;
    } = {}
  ): Promise<MemorySharingResult> {
    this.ensureInitialized();

    const result = await this.shareManager.shareMemory(
      memoryId,
      fromAgent,
      toAgents,
      permissions,
      options.scope,
      options.expiresAt
    );

    // Update statistics
    if (result.success) {
      this.stats.totalSharedMemories++;
      this.updateAgentActivity(fromAgent);
      this.stats.timestamp = new Date();
    }

    return result;
  }

  /**
   * Create shared memory pool
   */
  async createSharedPool(
    name: string,
    owner: string,
    participants: string[],
    policies?: MemorySharingPolicy[]
  ): Promise<SharedMemoryPool> {
    this.ensureInitialized();

    const pool = await this.poolManager.createPool(name, owner, participants, policies);

    // Update statistics
    this.stats.memoryPoolsCount++;
    this.updateAgentActivity(owner);
    this.stats.timestamp = new Date();

    return pool;
  }

  /**
   * Merge agent contexts
   */
  async mergeAgentContexts(
    agentIds: string[],
    config: ContextMergeConfig
  ): Promise<MergedContext> {
    this.ensureInitialized();

    return await this.contextMerger.mergeContexts(agentIds, config);
  }

  /**
   * Query across multiple agents
   */
  async crossAgentQuery(
    requestingAgent: string,
    targetAgents: string[],
    query: any,
    requiredPermissions: MemoryPermission[]
  ): Promise<CrossAgentQueryResult> {
    this.ensureInitialized();

    const result = await this.queryEngine.queryAgents(
      requestingAgent,
      targetAgents,
      query,
      requiredPermissions
    );

    // Update statistics
    this.stats.crossAgentQueries++;
    this.updateAgentActivity(requestingAgent);
    this.stats.timestamp = new Date();

    return result;
  }

  /**
   * Start collaboration session
   */
  async startCollaboration(
    name: string,
    participants: string[],
    leader: string
  ): Promise<AgentCollaborationSession> {
    this.ensureInitialized();

    const session = await this.sessionManager.createSession(name, participants, leader);

    // Update statistics
    this.stats.activeSharingSessions++;
    this.updateAgentActivity(leader);
    this.stats.timestamp = new Date();

    return session;
  }

  /**
   * Get sharing statistics
   */
  async getSharingStats(): Promise<MemorySharingStats> {
    this.ensureInitialized();

    // Update real-time statistics
    await this.updateRealTimeStats();

    return { ...this.stats };
  }

  /**
   * Cleanup expired sharing sessions
   */
  async cleanup(): Promise<void> {
    this.ensureInitialized();

    try {
      // Cleanup expired sharing
      await (this.shareManager as DefaultMemoryShareManager).cleanupExpiredSharing();

      // Cleanup expired sessions
      await (this.sessionManager as DefaultCollaborationSessionManager).cleanupExpiredSessions();

      // Update statistics
      this.stats.timestamp = new Date();

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Shutdown the cross-agent system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      // Stop cleanup timer
      this.stopCleanupTimer();

      // Perform final cleanup
      await this.cleanup();

      this.initialized = false;

    } catch (error) {
      console.error('Shutdown failed:', error);
    }
  }

  /**
   * Initialize all components
   */
  private async initializeComponents(): Promise<void> {
    // Components are initialized in constructor
    // This method is reserved for future initialization needs
  }

  /**
   * Start cleanup timer
   */
  private cleanupTimer?: NodeJS.Timeout;

  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, 60 * 60 * 1000);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Update agent activity tracking
   */
  private updateAgentActivity(agentId: string): void {
    const currentActive = this.stats.mostActiveAgents;
    const index = currentActive.indexOf(agentId);
    
    if (index >= 0) {
      // Move to front
      currentActive.splice(index, 1);
      currentActive.unshift(agentId);
    } else {
      // Add to front
      currentActive.unshift(agentId);
    }

    // Keep only top 10
    this.stats.mostActiveAgents = currentActive.slice(0, 10);
  }

  /**
   * Update real-time statistics
   */
  private async updateRealTimeStats(): Promise<void> {
    try {
      // Get current sharing requests
      const sharingRequests = (this.shareManager as DefaultMemoryShareManager).getAllSharingRequests();
      this.stats.pendingRequests = sharingRequests.filter(r => r.status === 'pending').length;

      // Get active sessions
      const allSessions = await (this.sessionManager as DefaultCollaborationSessionManager).getAllSessions();
      this.stats.activeSharingSessions = allSessions.filter(s => s.status === 'active').length;

      // Calculate success rate
      const totalRequests = sharingRequests.length;
      const successfulRequests = sharingRequests.filter(r => r.status === 'active').length;
      this.stats.sharingSuccessRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;

      // Calculate average sharing duration
      const activeSessions = allSessions.filter(s => s.status === 'active');
      if (activeSessions.length > 0) {
        const totalDuration = activeSessions.reduce((sum, session) => 
          sum + session.metadata.duration, 0);
        this.stats.averageSharingDuration = totalDuration / activeSessions.length;
      }

    } catch (error) {
      console.error('Failed to update real-time statistics:', error);
    }
  }

  /**
   * Ensure the system is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Cross-agent memory system not initialized');
    }
  }

  /**
   * Get memory share manager
   */
  getShareManager(): MemoryShareManager {
    return this.shareManager;
  }

  /**
   * Get pool manager
   */
  getPoolManager(): SharedMemoryPoolManager {
    return this.poolManager;
  }

  /**
   * Get context merger
   */
  getContextMerger(): ContextMerger {
    return this.contextMerger;
  }

  /**
   * Get query engine
   */
  getQueryEngine(): CrossAgentQueryEngine {
    return this.queryEngine;
  }

  /**
   * Get session manager
   */
  getSessionManager(): CollaborationSessionManager {
    return this.sessionManager;
  }

  /**
   * Get current statistics snapshot
   */
  getCurrentStats(): MemorySharingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalSharedMemories: 0,
      activeSharingSessions: 0,
      pendingRequests: 0,
      memoryPoolsCount: 0,
      crossAgentQueries: 0,
      conflictsResolved: 0,
      averageSharingDuration: 0,
      mostActiveAgents: [],
      sharingSuccessRate: 0,
      timestamp: new Date()
    };
  }
}