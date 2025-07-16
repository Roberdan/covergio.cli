/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  CollaborationSessionManager,
  MemoryShareManager,
  ContextMerger
} from './interfaces.js';
import {
  AgentCollaborationSession,
  MemorySharingPolicy,
  MemorySharingResult,
  MergedContext,
  ContextMergeConfig,
  ConflictResolution,
  MemoryPermission,
  SharingScope
} from './types.js';
import { MemoryItem } from '../types.js';
import { MemoryStore } from '../interfaces.js';

/**
 * Default implementation of collaboration session manager
 */
export class DefaultCollaborationSessionManager implements CollaborationSessionManager {
  private memoryStore: MemoryStore;
  private shareManager: MemoryShareManager;
  private contextMerger: ContextMerger;
  private sessions = new Map<string, AgentCollaborationSession>();

  constructor(
    memoryStore: MemoryStore,
    shareManager: MemoryShareManager,
    contextMerger: ContextMerger
  ) {
    this.memoryStore = memoryStore;
    this.shareManager = shareManager;
    this.contextMerger = contextMerger;
  }

  /**
   * Create collaboration session
   */
  async createSession(
    name: string,
    participants: string[],
    leader: string,
    policies?: MemorySharingPolicy[]
  ): Promise<AgentCollaborationSession> {
    const sessionId = uuidv4();
    const now = new Date();

    // Validate leader is in participants
    if (!participants.includes(leader)) {
      participants.push(leader);
    }

    // Create default policies if none provided
    const defaultPolicies: MemorySharingPolicy[] = policies || [
      {
        id: uuidv4(),
        name: 'Collaboration Session Policy',
        scope: 'session',
        defaultPermissions: [MemoryPermission.READ, MemoryPermission.WRITE],
        allowedScopes: [SharingScope.TEAM, SharingScope.GROUP],
        requiresApproval: false,
        autoExpire: true,
        conflictResolution: ConflictResolution.LATEST_WINS
      }
    ];

    // Create initial merged context
    const mergeConfig: ContextMergeConfig = {
      strategy: 'union',
      conflictResolution: ConflictResolution.LATEST_WINS,
      maxSize: 1000
    };

    const initialContext = await this.contextMerger.mergeContexts(participants, mergeConfig);

    const session: AgentCollaborationSession = {
      id: sessionId,
      name,
      participants,
      leader,
      sharedContext: initialContext,
      policies: defaultPolicies,
      status: 'active',
      metadata: {
        purpose: 'Collaborative memory sharing and context management',
        duration: 0,
        memoryUpdates: 0,
        collaborationScore: 0
      },
      startedAt: now
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Join collaboration session
   */
  async joinSession(sessionId: string, agentId: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'joinSession',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      // Check if agent is already in session
      if (session.participants.includes(agentId)) {
        return {
          success: false,
          message: `Agent ${agentId} is already in session ${sessionId}`,
          operation: 'joinSession',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Agent already in session')
        };
      }

      // Add agent to session
      session.participants.push(agentId);

      // Update shared context to include new agent's memories
      const updatedContext = await this.contextMerger.mergeContexts(
        session.participants,
        {
          strategy: 'union',
          conflictResolution: ConflictResolution.LATEST_WINS,
          maxSize: 1000
        }
      );

      session.sharedContext = updatedContext;
      session.metadata.memoryUpdates++;

      // Update collaboration score
      session.metadata.collaborationScore = this.calculateCollaborationScore(session);

      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Agent ${agentId} successfully joined session ${sessionId}`,
        operation: 'joinSession',
        memoryIds: updatedContext.memories.map(m => m.id),
        agents: [agentId],
        duration: Date.now() - startTime,
        metadata: {
          sessionName: session.name,
          participantCount: session.participants.length,
          contextSize: updatedContext.memories.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to join session: ${(error as Error).message}`,
        operation: 'joinSession',
        memoryIds: [],
        agents: [agentId],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Leave collaboration session
   */
  async leaveSession(sessionId: string, agentId: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'leaveSession',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      // Check if agent is in session
      const agentIndex = session.participants.indexOf(agentId);
      if (agentIndex === -1) {
        return {
          success: false,
          message: `Agent ${agentId} is not in session ${sessionId}`,
          operation: 'leaveSession',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Agent not in session')
        };
      }

      // Cannot leave if agent is the leader and there are other participants
      if (session.leader === agentId && session.participants.length > 1) {
        return {
          success: false,
          message: `Session leader ${agentId} cannot leave session ${sessionId} with other participants`,
          operation: 'leaveSession',
          memoryIds: [],
          agents: [agentId],
          duration: Date.now() - startTime,
          error: new Error('Leader cannot leave active session')
        };
      }

      // Remove agent from session
      session.participants.splice(agentIndex, 1);

      // If this was the last participant, end the session
      if (session.participants.length === 0) {
        session.status = 'ended';
        session.endedAt = new Date();
      } else {
        // Update shared context without the leaving agent
        const updatedContext = await this.contextMerger.mergeContexts(
          session.participants,
          {
            strategy: 'union',
            conflictResolution: ConflictResolution.LATEST_WINS,
            maxSize: 1000
          }
        );

        session.sharedContext = updatedContext;
        session.metadata.memoryUpdates++;
      }

      // Update collaboration score
      session.metadata.collaborationScore = this.calculateCollaborationScore(session);

      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Agent ${agentId} successfully left session ${sessionId}`,
        operation: 'leaveSession',
        memoryIds: [],
        agents: [agentId],
        duration: Date.now() - startTime,
        metadata: {
          sessionName: session.name,
          participantCount: session.participants.length,
          sessionStatus: session.status
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to leave session: ${(error as Error).message}`,
        operation: 'leaveSession',
        memoryIds: [],
        agents: [agentId],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Update shared context
   */
  async updateSharedContext(
    sessionId: string,
    updatingAgent: string,
    memories: MemoryItem[]
  ): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'updateSharedContext',
          memoryIds: memories.map(m => m.id),
          agents: [updatingAgent],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      // Check if agent is in session
      if (!session.participants.includes(updatingAgent)) {
        return {
          success: false,
          message: `Agent ${updatingAgent} is not in session ${sessionId}`,
          operation: 'updateSharedContext',
          memoryIds: memories.map(m => m.id),
          agents: [updatingAgent],
          duration: Date.now() - startTime,
          error: new Error('Agent not in session')
        };
      }

      // Merge new memories with existing context
      const allMemories = [...session.sharedContext.memories, ...memories];
      const updatedContext = await this.contextMerger.mergeMemories(
        allMemories,
        {
          strategy: 'union',
          conflictResolution: ConflictResolution.LATEST_WINS,
          maxSize: 1000
        }
      );

      session.sharedContext = updatedContext;
      session.metadata.memoryUpdates++;

      // Update collaboration score
      session.metadata.collaborationScore = this.calculateCollaborationScore(session);

      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Successfully updated shared context for session ${sessionId}`,
        operation: 'updateSharedContext',
        memoryIds: memories.map(m => m.id),
        agents: [updatingAgent],
        duration: Date.now() - startTime,
        metadata: {
          sessionName: session.name,
          memoriesAdded: memories.length,
          contextSize: updatedContext.memories.length
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to update shared context: ${(error as Error).message}`,
        operation: 'updateSharedContext',
        memoryIds: memories.map(m => m.id),
        agents: [updatingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<MergedContext | null> {
    const session = this.sessions.get(sessionId);
    return session ? session.sharedContext : null;
  }

  /**
   * End collaboration session
   */
  async endSession(sessionId: string, endingAgent: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'endSession',
          memoryIds: [],
          agents: [endingAgent],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      // Check if agent has permission to end session
      if (session.leader !== endingAgent) {
        return {
          success: false,
          message: `Agent ${endingAgent} does not have permission to end session ${sessionId}`,
          operation: 'endSession',
          memoryIds: [],
          agents: [endingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      // End session
      session.status = 'ended';
      session.endedAt = new Date();

      // Calculate final duration
      session.metadata.duration = session.endedAt.getTime() - session.startedAt.getTime();

      // Update collaboration score
      session.metadata.collaborationScore = this.calculateCollaborationScore(session);

      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Successfully ended session ${sessionId}`,
        operation: 'endSession',
        memoryIds: [],
        agents: [endingAgent],
        duration: Date.now() - startTime,
        metadata: {
          sessionName: session.name,
          participantCount: session.participants.length,
          sessionDuration: session.metadata.duration,
          collaborationScore: session.metadata.collaborationScore
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to end session: ${(error as Error).message}`,
        operation: 'endSession',
        memoryIds: [],
        agents: [endingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * List active sessions for agent
   */
  async listActiveSessions(agentId: string): Promise<AgentCollaborationSession[]> {
    const activeSessions: AgentCollaborationSession[] = [];

    for (const session of this.sessions.values()) {
      if (session.participants.includes(agentId) && session.status === 'active') {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  /**
   * Calculate collaboration score
   */
  private calculateCollaborationScore(session: AgentCollaborationSession): number {
    let score = 0;

    // Base score from participant count
    score += session.participants.length * 10;

    // Score from memory updates
    score += session.metadata.memoryUpdates * 5;

    // Score from context size
    score += session.sharedContext.memories.length * 2;

    // Score from session duration (points per minute)
    if (session.endedAt) {
      const durationMinutes = (session.endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60);
      score += Math.min(durationMinutes * 0.5, 100); // Cap at 100 points
    }

    // Score from merge statistics
    if (session.sharedContext.mergeStats) {
      score += session.sharedContext.mergeStats.conflictsResolved * 10;
      score -= session.sharedContext.mergeStats.duplicatesRemoved * 2; // Penalty for duplicates
    }

    return Math.max(0, score);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): AgentCollaborationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    endedSessions: number;
    averageParticipants: number;
    averageDuration: number;
    averageCollaborationScore: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const endedSessions = sessions.filter(s => s.status === 'ended').length;

    const averageParticipants = totalSessions > 0 ? 
      sessions.reduce((sum, s) => sum + s.participants.length, 0) / totalSessions : 0;

    const averageDuration = endedSessions > 0 ? 
      sessions.filter(s => s.status === 'ended')
        .reduce((sum, s) => sum + s.metadata.duration, 0) / endedSessions : 0;

    const averageCollaborationScore = totalSessions > 0 ? 
      sessions.reduce((sum, s) => sum + s.metadata.collaborationScore, 0) / totalSessions : 0;

    return {
      totalSessions,
      activeSessions,
      endedSessions,
      averageParticipants,
      averageDuration,
      averageCollaborationScore
    };
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions) {
      if (session.status === 'active') {
        const sessionAge = now.getTime() - session.startedAt.getTime();
        
        if (sessionAge > maxSessionDuration) {
          // Auto-end expired session
          session.status = 'ended';
          session.endedAt = now;
          session.metadata.duration = sessionAge;
          session.metadata.collaborationScore = this.calculateCollaborationScore(session);
          
          this.sessions.set(sessionId, session);
          
          console.log(`Auto-ended expired session ${sessionId}`);
        }
      }
    }
  }

  /**
   * Pause session
   */
  async pauseSession(sessionId: string, pausingAgent: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'pauseSession',
          memoryIds: [],
          agents: [pausingAgent],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      if (session.leader !== pausingAgent) {
        return {
          success: false,
          message: `Agent ${pausingAgent} does not have permission to pause session ${sessionId}`,
          operation: 'pauseSession',
          memoryIds: [],
          agents: [pausingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      session.status = 'paused';
      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Successfully paused session ${sessionId}`,
        operation: 'pauseSession',
        memoryIds: [],
        agents: [pausingAgent],
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to pause session: ${(error as Error).message}`,
        operation: 'pauseSession',
        memoryIds: [],
        agents: [pausingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }

  /**
   * Resume session
   */
  async resumeSession(sessionId: string, resumingAgent: string): Promise<MemorySharingResult> {
    const startTime = Date.now();

    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          message: `Session ${sessionId} not found`,
          operation: 'resumeSession',
          memoryIds: [],
          agents: [resumingAgent],
          duration: Date.now() - startTime,
          error: new Error('Session not found')
        };
      }

      if (session.leader !== resumingAgent) {
        return {
          success: false,
          message: `Agent ${resumingAgent} does not have permission to resume session ${sessionId}`,
          operation: 'resumeSession',
          memoryIds: [],
          agents: [resumingAgent],
          duration: Date.now() - startTime,
          error: new Error('Permission denied')
        };
      }

      session.status = 'active';
      this.sessions.set(sessionId, session);

      return {
        success: true,
        message: `Successfully resumed session ${sessionId}`,
        operation: 'resumeSession',
        memoryIds: [],
        agents: [resumingAgent],
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to resume session: ${(error as Error).message}`,
        operation: 'resumeSession',
        memoryIds: [],
        agents: [resumingAgent],
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }
}