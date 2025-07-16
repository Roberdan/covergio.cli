/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { MemoryShareManager } from './interfaces.js';
import {
  MemorySharingRequest,
  MemorySharingResult,
  MemoryPermission,
  SharingScope,
  SharingStatus,
  SharedMemoryItem,
  MemorySharingHistory
} from './types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of memory sharing manager
 */
export class DefaultMemoryShareManager implements MemoryShareManager {
  private memoryStore: MemoryStore;
  private sharingRequests = new Map<string, MemorySharingRequest>();
  private sharedMemories = new Map<string, SharedMemoryItem>();
  private agentPermissions = new Map<string, Map<string, MemoryPermission[]>>();
  private sharingHistory = new Map<string, MemorySharingHistory[]>();

  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Share memory with other agents
   */
  async shareMemory(
    memoryId: string,
    fromAgent: string,
    toAgents: string[],
    permissions: MemoryPermission[],
    scope: SharingScope = SharingScope.TEAM,
    expiresAt?: Date
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      // Validate memory exists
      const memory = await this.memoryStore.retrieve(memoryId);
      if (!memory) {
        return {
          success: false,
          message: `Memory ${memoryId} not found`,
          operation: 'shareMemory',
          memoryIds: [memoryId],
          agents: [fromAgent, ...toAgents],
          duration: Date.now() - startTime,
          error: new Error('Memory not found')
        };
      }

      // Check if fromAgent has permission to share
      if (!this.canShare(fromAgent, memoryId)) {
        return {
          success: false,
          message: `Agent ${fromAgent} does not have permission to share memory ${memoryId}`,
          operation: 'shareMemory',
          memoryIds: [memoryId],
          agents: [fromAgent, ...toAgents],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Create or update shared memory item
      const sharedMemory: SharedMemoryItem = {
        ...memory,
        originalOwner: fromAgent,
        sharingHistory: this.sharingHistory.get(memoryId) || [],
        agentPermissions: new Map(),
        sharingMetadata: {
          shareCount: 1,
          lastShared: new Date(),
          accessCount: new Map(),
          modificationCount: new Map(),
          expiresAt
        }
      };

      // Set permissions for target agents
      const agentPermissionsMap = this.agentPermissions.get(memoryId) || new Map();
      for (const agent of toAgents) {
        agentPermissionsMap.set(agent, permissions);
        sharedMemory.agentPermissions.set(agent, permissions);
      }
      this.agentPermissions.set(memoryId, agentPermissionsMap);

      // Record sharing history
      const historyEntry: MemorySharingHistory = {
        id: uuidv4(),
        action: 'shared',
        agent: fromAgent,
        targetAgents: toAgents,
        permissions,
        timestamp: new Date(),
        context: { scope, expiresAt }
      };

      const history = this.sharingHistory.get(memoryId) || [];
      history.push(historyEntry);
      this.sharingHistory.set(memoryId, history);
      sharedMemory.sharingHistory = history;

      // Store shared memory
      this.sharedMemories.set(memoryId, sharedMemory);

      return {
        success: true,
        message: `Successfully shared memory ${memoryId} with ${toAgents.length} agents`,
        operation: 'shareMemory',
        memoryIds: [memoryId],
        agents: [fromAgent, ...toAgents],
        duration: Date.now() - startTime,
        metadata: {
          permissions,
          scope,
          expiresAt: expiresAt?.toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to share memory: ${(error as Error).message}`,
        operation: 'shareMemory',
        memoryIds: [memoryId],
        agents: [fromAgent, ...toAgents],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Unshare memory from agents
   */
  async unshareMemory(
    memoryId: string,
    fromAgent: string,
    targetAgents: string[]
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const sharedMemory = this.sharedMemories.get(memoryId);
      if (!sharedMemory) {
        return {
          success: false,
          message: `Shared memory ${memoryId} not found`,
          operation: 'unshareMemory',
          memoryIds: [memoryId],
          agents: [fromAgent, ...targetAgents],
          duration: Date.now() - startTime,
          error: new Error('Shared memory not found')
        };
      }

      // Check permissions
      if (!this.canShare(fromAgent, memoryId)) {
        return {
          success: false,
          message: `Agent ${fromAgent} does not have permission to unshare memory ${memoryId}`,
          operation: 'unshareMemory',
          memoryIds: [memoryId],
          agents: [fromAgent, ...targetAgents],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Remove permissions for target agents
      const agentPermissionsMap = this.agentPermissions.get(memoryId) || new Map();
      for (const agent of targetAgents) {
        agentPermissionsMap.delete(agent);
        sharedMemory.agentPermissions.delete(agent);
      }
      this.agentPermissions.set(memoryId, agentPermissionsMap);

      // Record unsharing history
      const historyEntry: MemorySharingHistory = {
        id: uuidv4(),
        action: 'unshared',
        agent: fromAgent,
        targetAgents,
        timestamp: new Date()
      };

      const history = this.sharingHistory.get(memoryId) || [];
      history.push(historyEntry);
      this.sharingHistory.set(memoryId, history);
      sharedMemory.sharingHistory = history;

      // Update shared memory
      this.sharedMemories.set(memoryId, sharedMemory);

      return {
        success: true,
        message: `Successfully unshared memory ${memoryId} from ${targetAgents.length} agents`,
        operation: 'unshareMemory',
        memoryIds: [memoryId],
        agents: [fromAgent, ...targetAgents],
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to unshare memory: ${(error as Error).message}`,
        operation: 'unshareMemory',
        memoryIds: [memoryId],
        agents: [fromAgent, ...targetAgents],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Check if agent has permission to access memory
   */
  async checkPermissions(
    memoryId: string,
    agentId: string,
    permission: MemoryPermission
  ): Promise<boolean> {
    try {
      const agentPermissionsMap = this.agentPermissions.get(memoryId);
      if (!agentPermissionsMap) {
        return false;
      }

      const permissions = agentPermissionsMap.get(agentId);
      if (!permissions) {
        return false;
      }

      // Check if agent has the required permission or admin permission
      return permissions.includes(permission) || permissions.includes(MemoryPermission.ADMIN);

    } catch (error) {
      return false;
    }
  }

  /**
   * Get shared memories for an agent
   */
  async getSharedMemories(agentId: string): Promise<SharedMemoryItem[]> {
    const sharedMemories: SharedMemoryItem[] = [];

    for (const [memoryId, sharedMemory] of this.sharedMemories) {
      if (sharedMemory.agentPermissions.has(agentId)) {
        // Check if sharing hasn't expired
        if (sharedMemory.sharingMetadata.expiresAt && 
            sharedMemory.sharingMetadata.expiresAt < new Date()) {
          // Remove expired sharing
          await this.unshareMemory(sharedMemory.originalOwner, agentId, [agentId]);
          continue;
        }

        sharedMemories.push(sharedMemory);
      }
    }

    return sharedMemories;
  }

  /**
   * Update memory permissions
   */
  async updatePermissions(
    memoryId: string,
    permissions: Map<string, MemoryPermission[]>
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const sharedMemory = this.sharedMemories.get(memoryId);
      if (!sharedMemory) {
        return {
          success: false,
          message: `Shared memory ${memoryId} not found`,
          operation: 'updatePermissions',
          memoryIds: [memoryId],
          agents: Array.from(permissions.keys()),
          duration: Date.now() - startTime,
          error: new Error('Shared memory not found')
        };
      }

      // Update permissions
      this.agentPermissions.set(memoryId, permissions);
      sharedMemory.agentPermissions = permissions;

      // Update shared memory
      this.sharedMemories.set(memoryId, sharedMemory);

      return {
        success: true,
        message: `Successfully updated permissions for memory ${memoryId}`,
        operation: 'updatePermissions',
        memoryIds: [memoryId],
        agents: Array.from(permissions.keys()),
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update permissions: ${(error as Error).message}`,
        operation: 'updatePermissions',
        memoryIds: [memoryId],
        agents: Array.from(permissions.keys()),
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get sharing history for a memory
   */
  async getSharingHistory(memoryId: string): Promise<MemorySharingHistory[]> {
    return this.sharingHistory.get(memoryId) || [];
  }

  /**
   * Create sharing request
   */
  async createSharingRequest(
    request: Omit<MemorySharingRequest, 'id' | 'requestedAt' | 'status'>
  ): Promise<MemorySharingRequest> {
    const sharingRequest: MemorySharingRequest = {
      id: uuidv4(),
      requestedAt: new Date(),
      status: SharingStatus.PENDING,
      ...request
    };

    this.sharingRequests.set(sharingRequest.id, sharingRequest);
    return sharingRequest;
  }

  /**
   * Approve sharing request
   */
  async approveSharingRequest(
    requestId: string,
    approvingAgent: string
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const request = this.sharingRequests.get(requestId);
      if (!request) {
        return {
          success: false,
          message: `Sharing request ${requestId} not found`,
          operation: 'approveSharingRequest',
          memoryIds: [],
          agents: [approvingAgent],
          duration: Date.now() - startTime,
          error: new Error('Sharing request not found')
        };
      }

      // Check if approving agent has permission
      if (!request.toAgents.includes(approvingAgent)) {
        return {
          success: false,
          message: `Agent ${approvingAgent} is not authorized to approve this request`,
          operation: 'approveSharingRequest',
          memoryIds: [request.memoryId],
          agents: [approvingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Update request status
      request.status = SharingStatus.ACTIVE;
      this.sharingRequests.set(requestId, request);

      // Execute the sharing
      const result = await this.shareMemory(
        request.memoryId,
        request.fromAgent,
        request.toAgents,
        request.permissions,
        request.scope,
        request.expiresAt
      );

      return {
        ...result,
        operation: 'approveSharingRequest',
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to approve sharing request: ${(error as Error).message}`,
        operation: 'approveSharingRequest',
        memoryIds: [],
        agents: [approvingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Reject sharing request
   */
  async rejectSharingRequest(
    requestId: string,
    rejectingAgent: string,
    reason?: string
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const request = this.sharingRequests.get(requestId);
      if (!request) {
        return {
          success: false,
          message: `Sharing request ${requestId} not found`,
          operation: 'rejectSharingRequest',
          memoryIds: [],
          agents: [rejectingAgent],
          duration: Date.now() - startTime,
          error: new Error('Sharing request not found')
        };
      }

      // Check if rejecting agent has permission
      if (!request.toAgents.includes(rejectingAgent)) {
        return {
          success: false,
          message: `Agent ${rejectingAgent} is not authorized to reject this request`,
          operation: 'rejectSharingRequest',
          memoryIds: [request.memoryId],
          agents: [rejectingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // Update request status
      request.status = SharingStatus.REVOKED;
      if (reason) {
        request.metadata = { ...request.metadata, rejectionReason: reason };
      }
      this.sharingRequests.set(requestId, request);

      return {
        success: true,
        message: `Successfully rejected sharing request ${requestId}`,
        operation: 'rejectSharingRequest',
        memoryIds: [request.memoryId],
        agents: [rejectingAgent],
        duration: Date.now() - startTime,
        metadata: { reason }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to reject sharing request: ${(error as Error).message}`,
        operation: 'rejectSharingRequest',
        memoryIds: [],
        agents: [rejectingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Check if an agent can share a memory
   */
  private canShare(agentId: string, memoryId: string): boolean {
    const agentPermissionsMap = this.agentPermissions.get(memoryId);
    if (!agentPermissionsMap) {
      return true; // If no permissions set, assume owner can share
    }

    const permissions = agentPermissionsMap.get(agentId);
    if (!permissions) {
      return true; // If no permissions for agent, assume owner can share
    }

    return permissions.includes(MemoryPermission.SHARE) || 
           permissions.includes(MemoryPermission.ADMIN);
  }

  /**
   * Get all sharing requests
   */
  getAllSharingRequests(): MemorySharingRequest[] {
    return Array.from(this.sharingRequests.values());
  }

  /**
   * Get sharing requests for a specific agent
   */
  getSharingRequestsForAgent(agentId: string): MemorySharingRequest[] {
    return Array.from(this.sharingRequests.values()).filter(
      request => request.fromAgent === agentId || request.toAgents.includes(agentId)
    );
  }

  /**
   * Cleanup expired sharing sessions
   */
  async cleanupExpiredSharing(): Promise<void> {
    const now = new Date();
    const expiredMemories: string[] = [];

    for (const [memoryId, sharedMemory] of this.sharedMemories) {
      if (sharedMemory.sharingMetadata.expiresAt && 
          sharedMemory.sharingMetadata.expiresAt < now) {
        expiredMemories.push(memoryId);
      }
    }

    // Remove expired sharing
    for (const memoryId of expiredMemories) {
      this.sharedMemories.delete(memoryId);
      this.agentPermissions.delete(memoryId);
    }
  }
}