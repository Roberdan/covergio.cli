/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  BaseCollaborationPattern,
  AgentParticipation,
  TurnTakingRules,
  ConversationState,
  CollaborationOutcome
} from './CollaborationPattern';
import { SequentialPattern } from './patterns/SequentialPattern';
import { ParallelPattern } from './patterns/ParallelPattern';
import { DebatePattern } from './patterns/DebatePattern';
import { ConsultationPattern } from './patterns/ConsultationPattern';
import { BrainstormPattern } from './patterns/BrainstormPattern';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  CollaborationPattern,
  AutoGenError
} from '../types';

/**
 * Group chat configuration
 */
export interface GroupChatConfig {
  id: string;
  name: string;
  description: string;
  pattern: CollaborationPattern;
  participants: AgentParticipation[];
  rules: TurnTakingRules;
  settings: {
    autoArchive?: boolean;
    archiveAfterMinutes?: number;
    maxParticipants?: number;
    allowSpectators?: boolean;
    enableRecording?: boolean;
    moderationLevel?: 'none' | 'basic' | 'strict';
  };
}

/**
 * Active group chat session
 */
interface GroupChatSession {
  config: GroupChatConfig;
  pattern: BaseCollaborationPattern;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'archived';
  messageCount: number;
  participantActivity: Map<string, number>;
}

/**
 * Group chat metrics
 */
interface GroupChatMetrics {
  totalSessions: number;
  activeSessions: number;
  averageSessionDuration: number;
  averageParticipants: number;
  patternUsage: Record<CollaborationPattern, number>;
  successRate: number;
  topParticipants: Array<{ agentId: string; sessions: number; contributions: number }>;
}

/**
 * Group chat manager - orchestrates multi-agent conversations
 */
export class GroupChatManager extends EventEmitter {
  private activeSessions: Map<string, GroupChatSession> = new Map();
  private archivedSessions: Map<string, GroupChatSession> = new Map();
  private participantSessions: Map<string, Set<string>> = new Map(); // agentId -> sessionIds
  private metrics: GroupChatMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    averageSessionDuration: 0,
    averageParticipants: 0,
    patternUsage: {
      [CollaborationPattern.SEQUENTIAL]: 0,
      [CollaborationPattern.PARALLEL]: 0,
      [CollaborationPattern.HIERARCHICAL]: 0,
      [CollaborationPattern.DEBATE]: 0,
      [CollaborationPattern.CONSULTATION]: 0,
      [CollaborationPattern.BRAINSTORM]: 0
    },
    successRate: 0,
    topParticipants: []
  };

  constructor() {
    super();
    this.setupPeriodicTasks();
  }

  /**
   * Create a new group chat session
   */
  async createGroupChat(config: GroupChatConfig): Promise<string> {
    try {
      // Validate configuration
      this.validateGroupChatConfig(config);

      // Create collaboration pattern instance
      const pattern = this.createCollaborationPattern(config);

      // Create session
      const session: GroupChatSession = {
        config,
        pattern,
        startTime: new Date(),
        status: 'active',
        messageCount: 0,
        participantActivity: new Map()
      };

      // Initialize participant activity tracking
      for (const participant of config.participants) {
        session.participantActivity.set(participant.agentName, 0);
        
        // Track participant sessions
        if (!this.participantSessions.has(participant.agentName)) {
          this.participantSessions.set(participant.agentName, new Set());
        }
        this.participantSessions.get(participant.agentName)!.add(config.id);
      }

      // Store session
      this.activeSessions.set(config.id, session);

      // Update metrics
      this.metrics.totalSessions++;
      this.metrics.activeSessions++;
      this.metrics.patternUsage[config.pattern]++;

      // Setup pattern event listeners
      this.setupPatternEventListeners(pattern, config.id);

      // Initialize the collaboration pattern
      await pattern.initialize();

      this.emit('group-chat-created', {
        sessionId: config.id,
        config,
        participants: config.participants.map(p => p.agentName)
      });

      return config.id;

    } catch (error) {
      throw new AutoGenError(
        `Failed to create group chat: ${error.message}`,
        'GROUP_CHAT_CREATION_ERROR',
        { config, error }
      );
    }
  }

  /**
   * Add a message to a group chat
   */
  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AutoGenError(
        `Group chat session not found: ${sessionId}`,
        'SESSION_NOT_FOUND'
      );
    }

    if (session.status !== 'active') {
      throw new AutoGenError(
        `Cannot add message to ${session.status} session`,
        'SESSION_NOT_ACTIVE'
      );
    }

    try {
      // Add message to pattern
      await session.pattern.addMessage(message);

      // Update session metrics
      session.messageCount++;
      if (message.agent_id !== 'system') {
        const currentCount = session.participantActivity.get(message.agent_id) || 0;
        session.participantActivity.set(message.agent_id, currentCount + 1);
      }

      this.emit('message-added', {
        sessionId,
        message,
        messageCount: session.messageCount
      });

      // Check if session should be auto-archived
      await this.checkAutoArchive(sessionId, session);

    } catch (error) {
      throw new AutoGenError(
        `Failed to add message to group chat: ${error.message}`,
        'MESSAGE_ADD_ERROR',
        { sessionId, message, error }
      );
    }
  }

  /**
   * Get the next speaker for a group chat
   */
  getNextSpeaker(sessionId: string): AgentParticipation | null {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return null;
    }

    return session.pattern.selectNextSpeaker();
  }

  /**
   * Pause a group chat session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AutoGenError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    await session.pattern.pause();
    session.status = 'paused';

    this.emit('session-paused', { sessionId });
  }

  /**
   * Resume a paused group chat session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AutoGenError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    await session.pattern.resume();
    session.status = 'active';

    this.emit('session-resumed', { sessionId });
  }

  /**
   * Complete a group chat session
   */
  async completeSession(sessionId: string): Promise<CollaborationOutcome | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new AutoGenError(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    }

    session.status = 'completed';
    session.endTime = new Date();

    // Get outcome from pattern
    const outcome = session.pattern.getOutcome();

    // Update metrics
    this.metrics.activeSessions--;
    this.updateAverageSessionDuration(session);
    this.updateSuccessRate(outcome?.success || false);

    // Move to archived sessions
    this.archivedSessions.set(sessionId, session);
    this.activeSessions.delete(sessionId);

    this.emit('session-completed', {
      sessionId,
      outcome,
      duration: session.endTime.getTime() - session.startTime.getTime()
    });

    return outcome;
  }

  /**
   * Archive a group chat session
   */
  async archiveSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return; // Already archived or doesn't exist
    }

    session.status = 'archived';
    session.endTime = new Date();

    // Update metrics
    this.metrics.activeSessions--;

    // Move to archived sessions
    this.archivedSessions.set(sessionId, session);
    this.activeSessions.delete(sessionId);

    this.emit('session-archived', { sessionId });
  }

  /**
   * Get session state
   */
  getSessionState(sessionId: string): ConversationState | null {
    const session = this.activeSessions.get(sessionId) || this.archivedSessions.get(sessionId);
    return session ? session.pattern.getState() : null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{ id: string; config: GroupChatConfig; status: string }> {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      id,
      config: session.config,
      status: session.status
    }));
  }

  /**
   * Get sessions for a specific participant
   */
  getParticipantSessions(agentId: string): string[] {
    return Array.from(this.participantSessions.get(agentId) || []);
  }

  /**
   * Get group chat metrics
   */
  getMetrics(): GroupChatMetrics {
    this.updateTopParticipants();
    return { ...this.metrics };
  }

  /**
   * Validate group chat configuration
   */
  private validateGroupChatConfig(config: GroupChatConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Group chat must have id and name');
    }

    if (config.participants.length < 2) {
      throw new Error('Group chat must have at least 2 participants');
    }

    if (config.settings.maxParticipants && 
        config.participants.length > config.settings.maxParticipants) {
      throw new Error('Too many participants for group chat');
    }

    if (this.activeSessions.has(config.id)) {
      throw new Error(`Group chat with id ${config.id} already exists`);
    }
  }

  /**
   * Create collaboration pattern instance
   */
  private createCollaborationPattern(config: GroupChatConfig): BaseCollaborationPattern {
    const { id, participants, rules, pattern } = config;

    switch (pattern) {
      case CollaborationPattern.SEQUENTIAL:
        return new SequentialPattern(id, participants, rules);

      case CollaborationPattern.PARALLEL:
        return new ParallelPattern(id, participants, rules);

      case CollaborationPattern.DEBATE:
        return new DebatePattern(id, participants, rules);

      case CollaborationPattern.CONSULTATION:
        return new ConsultationPattern(id, participants, rules);

      case CollaborationPattern.BRAINSTORM:
        return new BrainstormPattern(id, participants, rules);

      default:
        throw new Error(`Unsupported collaboration pattern: ${pattern}`);
    }
  }

  /**
   * Setup event listeners for collaboration pattern
   */
  private setupPatternEventListeners(pattern: BaseCollaborationPattern, sessionId: string): void {
    pattern.on('collaboration-completed', (data) => {
      this.emit('collaboration-completed', { sessionId, ...data });
      this.completeSession(sessionId);
    });

    pattern.on('speaker-changed', (data) => {
      this.emit('speaker-changed', { sessionId, ...data });
    });

    pattern.on('message-added', (data) => {
      this.emit('pattern-message-added', { sessionId, ...data });
    });

    // Pattern-specific events
    pattern.on('round-completed', (data) => {
      this.emit('round-completed', { sessionId, ...data });
    });

    pattern.on('phase-changed', (data) => {
      this.emit('phase-changed', { sessionId, ...data });
    });

    pattern.on('work-assigned', (data) => {
      this.emit('work-assigned', { sessionId, ...data });
    });

    pattern.on('expert-response-added', (data) => {
      this.emit('expert-response-added', { sessionId, ...data });
    });

    pattern.on('idea-added', (data) => {
      this.emit('idea-added', { sessionId, ...data });
    });
  }

  /**
   * Check if session should be auto-archived
   */
  private async checkAutoArchive(sessionId: string, session: GroupChatSession): Promise<void> {
    const { autoArchive, archiveAfterMinutes } = session.config.settings;
    
    if (!autoArchive || !archiveAfterMinutes) return;

    const sessionDuration = Date.now() - session.startTime.getTime();
    const archiveThreshold = archiveAfterMinutes * 60 * 1000;

    if (sessionDuration > archiveThreshold) {
      await this.archiveSession(sessionId);
    }
  }

  /**
   * Setup periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Archive inactive sessions every 5 minutes
    setInterval(() => {
      this.archiveInactiveSessions();
    }, 5 * 60 * 1000);

    // Update metrics every minute
    setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000);
  }

  /**
   * Archive inactive sessions
   */
  private async archiveInactiveSessions(): Promise<void> {
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions) {
      const lastActivity = session.pattern.getState().lastActivity.getTime();
      
      if (now - lastActivity > inactivityThreshold) {
        await this.archiveSession(sessionId);
      }
    }
  }

  /**
   * Update session metrics
   */
  private updateMetrics(): void {
    this.metrics.activeSessions = this.activeSessions.size;
    this.updateAverageParticipants();
  }

  /**
   * Update average session duration
   */
  private updateAverageSessionDuration(session: GroupChatSession): void {
    if (!session.endTime) return;

    const duration = session.endTime.getTime() - session.startTime.getTime();
    const totalSessions = this.metrics.totalSessions;
    
    this.metrics.averageSessionDuration = 
      ((this.metrics.averageSessionDuration * (totalSessions - 1)) + duration) / totalSessions;
  }

  /**
   * Update average participants
   */
  private updateAverageParticipants(): void {
    let totalParticipants = 0;
    let sessionCount = 0;

    for (const session of this.activeSessions.values()) {
      totalParticipants += session.config.participants.length;
      sessionCount++;
    }

    for (const session of this.archivedSessions.values()) {
      totalParticipants += session.config.participants.length;
      sessionCount++;
    }

    this.metrics.averageParticipants = sessionCount > 0 ? totalParticipants / sessionCount : 0;
  }

  /**
   * Update success rate
   */
  private updateSuccessRate(wasSuccessful: boolean): void {
    const total = this.metrics.totalSessions;
    const currentSuccessful = this.metrics.successRate * (total - 1);
    const newSuccessful = currentSuccessful + (wasSuccessful ? 1 : 0);
    
    this.metrics.successRate = newSuccessful / total;
  }

  /**
   * Update top participants
   */
  private updateTopParticipants(): void {
    const participantStats = new Map<string, { sessions: number; contributions: number }>();

    // Count from active sessions
    for (const session of this.activeSessions.values()) {
      for (const [agentId, contributions] of session.participantActivity) {
        const stats = participantStats.get(agentId) || { sessions: 0, contributions: 0 };
        stats.sessions++;
        stats.contributions += contributions;
        participantStats.set(agentId, stats);
      }
    }

    // Count from archived sessions
    for (const session of this.archivedSessions.values()) {
      for (const [agentId, contributions] of session.participantActivity) {
        const stats = participantStats.get(agentId) || { sessions: 0, contributions: 0 };
        stats.sessions++;
        stats.contributions += contributions;
        participantStats.set(agentId, stats);
      }
    }

    // Sort and take top 10
    this.metrics.topParticipants = Array.from(participantStats.entries())
      .map(([agentId, stats]) => ({ agentId, ...stats }))
      .sort((a, b) => (b.contributions + b.sessions) - (a.contributions + a.sessions))
      .slice(0, 10);
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId: string): {
    config: GroupChatConfig;
    duration: number;
    messageCount: number;
    participantActivity: Record<string, number>;
    outcome: CollaborationOutcome | null;
  } | null {
    const session = this.activeSessions.get(sessionId) || this.archivedSessions.get(sessionId);
    if (!session) return null;

    const duration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    return {
      config: session.config,
      duration,
      messageCount: session.messageCount,
      participantActivity: Object.fromEntries(session.participantActivity),
      outcome: session.pattern.getOutcome()
    };
  }

  /**
   * Clean up completed and archived sessions
   */
  async cleanup(olderThanDays: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.archivedSessions) {
      if (session.startTime.getTime() < cutoffTime) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      this.archivedSessions.delete(sessionId);
    }

    this.emit('sessions-cleaned', {
      removedCount: sessionsToRemove.length,
      cutoffTime: new Date(cutoffTime)
    });
  }
}