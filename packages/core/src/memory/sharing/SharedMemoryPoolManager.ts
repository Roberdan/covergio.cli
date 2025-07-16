/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { SharedMemoryPoolManager, MemoryShareManager } from './interfaces.js';
import {
  SharedMemoryPool,
  MemorySharingPolicy,
  MemorySharingResult,
  MemoryPermission,
  SharedMemoryPoolMetadata,
  SharingScope,
  ConflictResolution
} from './types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of shared memory pool manager
 */
export class DefaultSharedMemoryPoolManager implements SharedMemoryPoolManager {
  private memoryStore: MemoryStore;
  private shareManager: MemoryShareManager;
  private pools = new Map<string, SharedMemoryPool>();

  constructor(memoryStore: MemoryStore, shareManager: MemoryShareManager) {
    this.memoryStore = memoryStore;
    this.shareManager = shareManager;
  }

  /**
   * Create a new shared memory pool
   */
  async createPool(
    name: string,
    owner: string,
    participants: string[],
    policies?: MemorySharingPolicy[]
  ): Promise<SharedMemoryPool> {
    const poolId = uuidv4();
    const now = new Date();

    // Create default policies if none provided
    const defaultPolicies: MemorySharingPolicy[] = policies || [
      {
        id: uuidv4(),
        name: 'Default Pool Policy',
        scope: 'pool',
        defaultPermissions: [MemoryPermission.READ, MemoryPermission.WRITE],
        allowedScopes: [SharingScope.TEAM, SharingScope.GROUP],
        requiresApproval: false,
        autoExpire: true,
        conflictResolution: ConflictResolution.LATEST_WINS
      }
    ];

    // Initialize permissions for all participants
    const permissions = new Map<string, MemoryPermission[]>();
    
    // Owner gets all permissions
    permissions.set(owner, [
      MemoryPermission.READ,
      MemoryPermission.WRITE,
      MemoryPermission.DELETE,
      MemoryPermission.SHARE,
      MemoryPermission.ADMIN
    ]);

    // Participants get default permissions from policies
    for (const participant of participants) {
      if (participant !== owner) {
        permissions.set(participant, defaultPolicies[0].defaultPermissions);
      }
    }

    // Create pool metadata
    const metadata: SharedMemoryPoolMetadata = {
      size: 0,
      memoryCount: 0,
      activityStats: new Map(),
      tags: [],
      priority: 1
    };

    // Initialize activity stats for all participants
    for (const participant of [owner, ...participants]) {
      metadata.activityStats.set(participant, 0);
    }

    const pool: SharedMemoryPool = {
      id: poolId,
      name,
      description: `Shared memory pool for ${participants.length + 1} agents`,
      owner,
      participants: [owner, ...participants.filter(p => p !== owner)],
      permissions,
      policies: defaultPolicies,
      memories: new Map(),
      metadata,
      createdAt: now,
      updatedAt: now
    };

    this.pools.set(poolId, pool);
    return pool;
  }

  /**
   * Delete a memory pool
   */
  async deletePool(poolId: string, deletingAgent: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'deletePool',
          memoryIds: [],
          agents: [deletingAgent],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Check if agent has permission to delete
      if (pool.owner !== deletingAgent) {
        const agentPermissions = pool.permissions.get(deletingAgent);
        if (!agentPermissions || !agentPermissions.includes(MemoryPermission.ADMIN)) {
          return {
            success: false,
            message: `Agent ${deletingAgent} does not have permission to delete pool ${poolId}`,
            operation: 'deletePool',
            memoryIds: [],
            agents: [deletingAgent],
            duration: Date.now() - startTime,
            error: new Error('Permission denied')
          };
        }
      }

      // Unshare all memories in the pool
      const memoryIds = Array.from(pool.memories.keys());
      for (const memoryId of memoryIds) {
        await this.shareManager.unshareMemory(memoryId, deletingAgent, pool.participants);
      }

      // Remove the pool
      this.pools.delete(poolId);

      return {
        success: true,
        message: `Successfully deleted pool ${poolId}`,
        operation: 'deletePool',
        memoryIds,
        agents: [deletingAgent],
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          memoriesUnshared: memoryIds.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to delete pool: ${(error as Error).message}`,
        operation: 'deletePool',
        memoryIds: [],
        agents: [deletingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Add agent to pool
   */
  async addAgentToPool(
    poolId: string,
    agentId: string,
    permissions: MemoryPermission[]
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'addAgentToPool',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Check if agent is already in pool
      if (pool.participants.includes(agentId)) {
        return {
          success: false,
          message: `Agent ${agentId} is already in pool ${poolId}`,
          operation: 'addAgentToPool',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Agent already in pool')
        };
      }

      // Add agent to pool
      pool.participants.push(agentId);
      pool.permissions.set(agentId, permissions);
      pool.metadata.activityStats.set(agentId, 0);
      pool.updatedAt = new Date();

      // Share all existing memories with the new agent
      const memoryIds = Array.from(pool.memories.keys());
      for (const memoryId of memoryIds) {
        await this.shareManager.shareMemory(
          memoryId,
          pool.owner,
          [agentId],
          permissions
        );
      }

      this.pools.set(poolId, pool);

      return {
        success: true,
        message: `Successfully added agent ${agentId} to pool ${poolId}`,
        operation: 'addAgentToPool',
        memoryIds,
        agents: [agentId],
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          permissions: permissions.join(', '),
          sharedMemories: memoryIds.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to add agent to pool: ${(error as Error).message}`,
        operation: 'addAgentToPool',
        memoryIds: [],
        agents: [agentId],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Remove agent from pool
   */
  async removeAgentFromPool(poolId: string, agentId: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'removeAgentFromPool',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Check if agent is in pool
      const agentIndex = pool.participants.indexOf(agentId);
      if (agentIndex === -1) {
        return {
          success: false,
          message: `Agent ${agentId} is not in pool ${poolId}`,
          operation: 'removeAgentFromPool',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Agent not in pool')
        };
      }

      // Cannot remove pool owner
      if (pool.owner === agentId) {
        return {
          success: false,
          message: `Cannot remove pool owner ${agentId} from pool ${poolId}`,
          operation: 'removeAgentFromPool',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Cannot remove pool owner')
        };
      }

      // Remove agent from pool
      pool.participants.splice(agentIndex, 1);
      pool.permissions.delete(agentId);
      pool.metadata.activityStats.delete(agentId);
      pool.updatedAt = new Date();

      // Unshare all memories from the agent
      const memoryIds = Array.from(pool.memories.keys());
      for (const memoryId of memoryIds) {
        await this.shareManager.unshareMemory(memoryId, pool.owner, [agentId]);
      }

      this.pools.set(poolId, pool);

      return {
        success: true,
        message: `Successfully removed agent ${agentId} from pool ${poolId}`,
        operation: 'removeAgentFromPool',
        memoryIds,
        agents: [agentId],
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          unsharedMemories: memoryIds.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to remove agent from pool: ${(error as Error).message}`,
        operation: 'removeAgentFromPool',
        memoryIds: [],
        agents: [agentId],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Add memory to pool
   */
  async addMemoryToPool(
    poolId: string,
    memoryId: string,
    addingAgent: string
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'addMemoryToPool',
          memoryIds: [memoryId],
          agents: [addingAgent],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Check if adding agent is in pool
      if (!pool.participants.includes(addingAgent)) {
        return {
          success: false,
          message: `Agent ${addingAgent} is not a participant in pool ${poolId}`,
          operation: 'addMemoryToPool',
          memoryIds: [memoryId],
          agents: [addingAgent],
          duration: Date.now() - startTime,
          error: new Error('Agent not in pool')
        };
      }

      // Check if memory exists
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        return {
          success: false,
          message: `Memory ${memoryId} not found`,
          operation: 'addMemoryToPool',
          memoryIds: [memoryId],
          agents: [addingAgent],
          duration: Date.now() - startTime,
          error: new Error('Memory not found')
        };
      }

      // Check if memory is already in pool
      if (pool.memories.has(memoryId)) {
        return {
          success: false,
          message: `Memory ${memoryId} is already in pool ${poolId}`,
          operation: 'addMemoryToPool',
          memoryIds: [memoryId],
          agents: [addingAgent],
          duration: Date.now() - startTime,
          error: new Error('Memory already in pool')
        };
      }

      // Get agent permissions
      const agentPermissions = pool.permissions.get(addingAgent);
      if (!agentPermissions || !agentPermissions.includes(MemoryPermission.SHARE)) {
        return {
          success: false,
          message: `Agent ${addingAgent} does not have permission to add memory to pool ${poolId}`,
          operation: 'addMemoryToPool',
          memoryIds: [memoryId],
          agents: [addingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Share memory with all pool participants
      const otherParticipants = pool.participants.filter(p => p !== addingAgent);
      if (otherParticipants.length > 0) {
        const shareResult = await this.shareManager.shareMemory(
          memoryId,
          addingAgent,
          otherParticipants,
          [MemoryPermission.READ, MemoryPermission.WRITE]
        );

        if (!shareResult.success) {
          return {
            success: false,
            message: `Failed to share memory with pool participants: ${shareResult.message}`,
            operation: 'addMemoryToPool',
            memoryIds: [memoryId],
            agents: [addingAgent],
            duration: Date.now() - startTime,
            error: shareResult.error
          };
        }
      }

      // Add memory to pool
      const sharedMemories = await this.shareManager.getSharedMemories(addingAgent);
      const sharedMemory = sharedMemories.find(sm => sm.id === memoryId);
      
      if (sharedMemory) {
        pool.memories.set(memoryId, sharedMemory);
      } else {
        // Create a shared memory item if not found
        const sharedMemoryItem = {
          ...memory,
          originalOwner: addingAgent,
          sharingHistory: [],
          agentPermissions: new Map(),
          sharingMetadata: {
            shareCount: 1,
            lastShared: new Date(),
            accessCount: new Map(),
            modificationCount: new Map()
          }
        };
        pool.memories.set(memoryId, sharedMemoryItem);
      }

      // Update pool metadata
      pool.metadata.memoryCount++;
      pool.metadata.size += memory.content.length;
      pool.updatedAt = new Date();

      // Update activity stats
      const currentActivity = pool.metadata.activityStats.get(addingAgent) || 0;
      pool.metadata.activityStats.set(addingAgent, currentActivity + 1);

      this.pools.set(poolId, pool);

      return {
        success: true,
        message: `Successfully added memory ${memoryId} to pool ${poolId}`,
        operation: 'addMemoryToPool',
        memoryIds: [memoryId],
        agents: [addingAgent, ...otherParticipants],
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          sharedWith: otherParticipants.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to add memory to pool: ${(error as Error).message}`,
        operation: 'addMemoryToPool',
        memoryIds: [memoryId],
        agents: [addingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Remove memory from pool
   */
  async removeMemoryFromPool(
    poolId: string,
    memoryId: string,
    removingAgent: string
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'removeMemoryFromPool',
          memoryIds: [memoryId],
          agents: [removingAgent],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Check if removing agent is in pool
      if (!pool.participants.includes(removingAgent)) {
        return {
          success: false,
          message: `Agent ${removingAgent} is not a participant in pool ${poolId}`,
          operation: 'removeMemoryFromPool',
          memoryIds: [memoryId],
          agents: [removingAgent],
          duration: Date.now() - startTime,
          error: new Error('Agent not in pool')
        };
      }

      // Check if memory is in pool
      const sharedMemory = pool.memories.get(memoryId);
      if (!sharedMemory) {
        return {
          success: false,
          message: `Memory ${memoryId} is not in pool ${poolId}`,
          operation: 'removeMemoryFromPool',
          memoryIds: [memoryId],
          agents: [removingAgent],
          duration: Date.now() - startTime,
          error: new Error('Memory not in pool')
        };
      }

      // Check permissions
      const agentPermissions = pool.permissions.get(removingAgent);
      if (!agentPermissions || 
          (!agentPermissions.includes(MemoryPermission.ADMIN) && 
           !agentPermissions.includes(MemoryPermission.DELETE) &&
           sharedMemory.originalOwner !== removingAgent)) {
        return {
          success: false,
          message: `Agent ${removingAgent} does not have permission to remove memory from pool ${poolId}`,
          operation: 'removeMemoryFromPool',
          memoryIds: [memoryId],
          agents: [removingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Unshare memory from all pool participants
      const otherParticipants = pool.participants.filter(p => p !== removingAgent);
      if (otherParticipants.length > 0) {
        await this.shareManager.unshareMemory(memoryId, removingAgent, otherParticipants);
      }

      // Remove memory from pool
      pool.memories.delete(memoryId);

      // Update pool metadata
      pool.metadata.memoryCount--;
      pool.metadata.size -= sharedMemory.content.length;
      pool.updatedAt = new Date();

      // Update activity stats
      const currentActivity = pool.metadata.activityStats.get(removingAgent) || 0;
      pool.metadata.activityStats.set(removingAgent, currentActivity + 1);

      this.pools.set(poolId, pool);

      return {
        success: true,
        message: `Successfully removed memory ${memoryId} from pool ${poolId}`,
        operation: 'removeMemoryFromPool',
        memoryIds: [memoryId],
        agents: [removingAgent, ...otherParticipants],
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          unsharedFrom: otherParticipants.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to remove memory from pool: ${(error as Error).message}`,
        operation: 'removeMemoryFromPool',
        memoryIds: [memoryId],
        agents: [removingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get pool by ID
   */
  async getPool(poolId: string): Promise<SharedMemoryPool | null> {
    return this.pools.get(poolId) || null;
  }

  /**
   * List pools for agent
   */
  async listPoolsForAgent(agentId: string): Promise<SharedMemoryPool[]> {
    const pools: SharedMemoryPool[] = [];

    for (const pool of this.pools.values()) {
      if (pool.participants.includes(agentId)) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Update pool policies
   */
  async updatePoolPolicies(
    poolId: string,
    policies: MemorySharingPolicy[]
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const pool = this.pools.get(poolId);
      if (!pool) {
        return {
          success: false,
          message: `Pool ${poolId} not found`,
          operation: 'updatePoolPolicies',
          memoryIds: [],
          agents: [],
          duration: Date.now() - startTime,
          error: new Error('Pool not found')
        };
      }

      // Update policies
      pool.policies = policies;
      pool.updatedAt = new Date();

      this.pools.set(poolId, pool);

      return {
        success: true,
        message: `Successfully updated policies for pool ${poolId}`,
        operation: 'updatePoolPolicies',
        memoryIds: [],
        agents: pool.participants,
        duration: Date.now() - startTime,
        metadata: {
          poolName: pool.name,
          policiesCount: policies.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update pool policies: ${(error as Error).message}`,
        operation: 'updatePoolPolicies',
        memoryIds: [],
        agents: [],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get all pools
   */
  getAllPools(): SharedMemoryPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    totalPools: number;
    totalMemories: number;
    totalParticipants: number;
    averagePoolSize: number;
  } {
    const pools = Array.from(this.pools.values());
    const totalPools = pools.length;
    const totalMemories = pools.reduce((sum, pool) => sum + pool.metadata.memoryCount, 0);
    const totalParticipants = pools.reduce((sum, pool) => sum + pool.participants.length, 0);
    const averagePoolSize = totalPools > 0 ? totalMemories / totalPools : 0;

    return {
      totalPools,
      totalMemories,
      totalParticipants,
      averagePoolSize
    };
  }
}