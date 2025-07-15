/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { GroupChatManager, GroupChatConfig } from '../collaboration/GroupChatManager';
import { AgentParticipation, TurnTakingRules } from '../collaboration/CollaborationPattern';
import { CollaborationPattern, ConversationMessage } from '../types';

describe('GroupChatManager', () => {
  let manager: GroupChatManager;
  let mockConfig: GroupChatConfig;
  let mockParticipants: AgentParticipation[];

  beforeEach(() => {
    manager = new GroupChatManager();
    
    mockParticipants = [
      {
        agentName: 'agent1',
        role: 'moderator',
        priority: 10,
        canInitiate: true,
        canInterrupt: true,
        maxConsecutiveTurns: 3
      },
      {
        agentName: 'agent2',
        role: 'participant',
        priority: 8,
        canInitiate: true,
        canInterrupt: false,
        maxConsecutiveTurns: 2
      },
      {
        agentName: 'agent3',
        role: 'participant',
        priority: 6,
        canInitiate: false,
        canInterrupt: false,
        maxConsecutiveTurns: 2
      }
    ];

    const mockRules: TurnTakingRules = {
      maxTurnsPerAgent: 3,
      allowConsecutiveTurns: false,
      prioritizeExpertise: true,
      interruptionPolicy: 'moderator-only',
      timeoutBetweenTurns: 5000,
      maxConversationTurns: 20
    };

    mockConfig = {
      id: 'test-session-1',
      name: 'Test Group Chat',
      description: 'A test group chat session',
      pattern: CollaborationPattern.SEQUENTIAL,
      participants: mockParticipants,
      rules: mockRules,
      settings: {
        autoArchive: false,
        maxParticipants: 10,
        allowSpectators: false,
        enableRecording: true,
        moderationLevel: 'basic'
      }
    };
  });

  describe('createGroupChat', () => {
    it('should create a new group chat session successfully', async () => {
      const sessionId = await manager.createGroupChat(mockConfig);
      
      expect(sessionId).toBe('test-session-1');
      
      const activeSessions = manager.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe('test-session-1');
      expect(activeSessions[0].status).toBe('active');
    });

    it('should emit group-chat-created event', async () => {
      const eventListener = vi.fn();
      manager.on('group-chat-created', eventListener);

      await manager.createGroupChat(mockConfig);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session-1',
        config: mockConfig,
        participants: ['agent1', 'agent2', 'agent3']
      });
    });

    it('should reject duplicate session IDs', async () => {
      await manager.createGroupChat(mockConfig);

      await expect(manager.createGroupChat(mockConfig))
        .rejects.toThrow('Group chat with id test-session-1 already exists');
    });

    it('should reject invalid configurations', async () => {
      const invalidConfig = {
        ...mockConfig,
        participants: [mockParticipants[0]] // Only one participant
      };

      await expect(manager.createGroupChat(invalidConfig))
        .rejects.toThrow('Group chat must have at least 2 participants');
    });

    it('should update metrics when creating session', async () => {
      const initialMetrics = manager.getMetrics();
      expect(initialMetrics.totalSessions).toBe(0);
      expect(initialMetrics.activeSessions).toBe(0);

      await manager.createGroupChat(mockConfig);

      const updatedMetrics = manager.getMetrics();
      expect(updatedMetrics.totalSessions).toBe(1);
      expect(updatedMetrics.activeSessions).toBe(1);
      expect(updatedMetrics.patternUsage[CollaborationPattern.SEQUENTIAL]).toBe(1);
    });
  });

  describe('addMessage', () => {
    beforeEach(async () => {
      await manager.createGroupChat(mockConfig);
    });

    it('should add message to active session', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Hello, this is agent1 speaking.',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await manager.addMessage('test-session-1', message);

      const state = manager.getSessionState('test-session-1');
      expect(state?.history).toHaveLength(1);
      expect(state?.history[0].content).toBe('Hello, this is agent1 speaking.');
    });

    it('should emit message-added event', async () => {
      const eventListener = vi.fn();
      manager.on('message-added', eventListener);

      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Test message',
        timestamp: new Date().toISOString(),
        agent_id: 'agent2'
      };

      await manager.addMessage('test-session-1', message);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId: 'test-session-1',
        message,
        messageCount: 1
      });
    });

    it('should reject messages to non-existent sessions', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Test',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await expect(manager.addMessage('non-existent', message))
        .rejects.toThrow('Group chat session not found: non-existent');
    });

    it('should update participant activity', async () => {
      const message1: ConversationMessage = {
        role: 'assistant',
        content: 'Message from agent1',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      const message2: ConversationMessage = {
        role: 'assistant',
        content: 'Message from agent2',
        timestamp: new Date().toISOString(),
        agent_id: 'agent2'
      };

      await manager.addMessage('test-session-1', message1);
      await manager.addMessage('test-session-1', message2);
      await manager.addMessage('test-session-1', message1); // agent1 again

      const summary = manager.getSessionSummary('test-session-1');
      expect(summary?.participantActivity['agent1']).toBe(2);
      expect(summary?.participantActivity['agent2']).toBe(1);
    });
  });

  describe('session lifecycle', () => {
    beforeEach(async () => {
      await manager.createGroupChat(mockConfig);
    });

    it('should pause and resume sessions', async () => {
      await manager.pauseSession('test-session-1');
      
      const pauseEventListener = vi.fn();
      manager.on('session-paused', pauseEventListener);
      
      const resumeEventListener = vi.fn();
      manager.on('session-resumed', resumeEventListener);

      await manager.pauseSession('test-session-1');
      expect(pauseEventListener).toHaveBeenCalledWith({ sessionId: 'test-session-1' });

      await manager.resumeSession('test-session-1');
      expect(resumeEventListener).toHaveBeenCalledWith({ sessionId: 'test-session-1' });
    });

    it('should complete sessions and move to archive', async () => {
      const completionListener = vi.fn();
      manager.on('session-completed', completionListener);

      const outcome = await manager.completeSession('test-session-1');

      expect(outcome).toBeDefined();
      expect(completionListener).toHaveBeenCalled();
      
      const activeSessions = manager.getActiveSessions();
      expect(activeSessions).toHaveLength(0);

      const summary = manager.getSessionSummary('test-session-1');
      expect(summary).toBeDefined();
    });

    it('should archive sessions', async () => {
      const archiveListener = vi.fn();
      manager.on('session-archived', archiveListener);

      await manager.archiveSession('test-session-1');

      expect(archiveListener).toHaveBeenCalledWith({ sessionId: 'test-session-1' });
      
      const activeSessions = manager.getActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('collaboration patterns', () => {
    it('should create sequential pattern', async () => {
      const sequentialConfig = {
        ...mockConfig,
        id: 'sequential-session',
        pattern: CollaborationPattern.SEQUENTIAL
      };

      await manager.createGroupChat(sequentialConfig);
      const nextSpeaker = manager.getNextSpeaker('sequential-session');
      
      expect(nextSpeaker).toBeDefined();
      expect(['agent1', 'agent2', 'agent3']).toContain(nextSpeaker?.agentName);
    });

    it('should create parallel pattern', async () => {
      const parallelConfig = {
        ...mockConfig,
        id: 'parallel-session',
        pattern: CollaborationPattern.PARALLEL
      };

      await manager.createGroupChat(parallelConfig);
      const nextSpeaker = manager.getNextSpeaker('parallel-session');
      
      expect(nextSpeaker).toBeDefined();
    });

    it('should create debate pattern', async () => {
      const debateConfig = {
        ...mockConfig,
        id: 'debate-session',
        pattern: CollaborationPattern.DEBATE
      };

      await manager.createGroupChat(debateConfig);
      const nextSpeaker = manager.getNextSpeaker('debate-session');
      
      expect(nextSpeaker).toBeDefined();
    });

    it('should create consultation pattern', async () => {
      const consultationConfig = {
        ...mockConfig,
        id: 'consultation-session',
        pattern: CollaborationPattern.CONSULTATION,
        participants: [
          { ...mockParticipants[0], role: 'requester' },
          { ...mockParticipants[1], role: 'specialist', specializations: ['technical'] },
          { ...mockParticipants[2], role: 'specialist', specializations: ['business'] }
        ]
      };

      await manager.createGroupChat(consultationConfig);
      const nextSpeaker = manager.getNextSpeaker('consultation-session');
      
      expect(nextSpeaker).toBeDefined();
    });

    it('should create brainstorm pattern', async () => {
      const brainstormConfig = {
        ...mockConfig,
        id: 'brainstorm-session',
        pattern: CollaborationPattern.BRAINSTORM
      };

      await manager.createGroupChat(brainstormConfig);
      const nextSpeaker = manager.getNextSpeaker('brainstorm-session');
      
      expect(nextSpeaker).toBeDefined();
    });
  });

  describe('metrics and analytics', () => {
    it('should track pattern usage', async () => {
      await manager.createGroupChat({
        ...mockConfig,
        id: 'session-1',
        pattern: CollaborationPattern.SEQUENTIAL
      });

      await manager.createGroupChat({
        ...mockConfig,
        id: 'session-2',
        pattern: CollaborationPattern.DEBATE
      });

      await manager.createGroupChat({
        ...mockConfig,
        id: 'session-3',
        pattern: CollaborationPattern.SEQUENTIAL
      });

      const metrics = manager.getMetrics();
      expect(metrics.patternUsage[CollaborationPattern.SEQUENTIAL]).toBe(2);
      expect(metrics.patternUsage[CollaborationPattern.DEBATE]).toBe(1);
      expect(metrics.totalSessions).toBe(3);
      expect(metrics.activeSessions).toBe(3);
    });

    it('should calculate session duration', async () => {
      // Simulate some time passing
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
      
      await manager.createGroupChat(mockConfig);
      
      vi.setSystemTime(new Date('2025-01-01T12:05:00Z')); // 5 minutes later
      
      await manager.completeSession('test-session-1');
      
      const summary = manager.getSessionSummary('test-session-1');
      expect(summary?.duration).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
      
      vi.useRealTimers();
    });

    it('should track participant sessions', async () => {
      await manager.createGroupChat(mockConfig);
      
      const agent1Sessions = manager.getParticipantSessions('agent1');
      expect(agent1Sessions).toContain('test-session-1');
      
      const agent2Sessions = manager.getParticipantSessions('agent2');
      expect(agent2Sessions).toContain('test-session-1');
    });
  });

  describe('error handling', () => {
    it('should handle invalid session operations', async () => {
      await expect(manager.pauseSession('non-existent'))
        .rejects.toThrow('Session not found: non-existent');

      await expect(manager.resumeSession('non-existent'))
        .rejects.toThrow('Session not found: non-existent');

      await expect(manager.completeSession('non-existent'))
        .rejects.toThrow('Session not found: non-existent');
    });

    it('should handle messages to inactive sessions', async () => {
      await manager.createGroupChat(mockConfig);
      await manager.pauseSession('test-session-1');

      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Test',
        timestamp: new Date().toISOString(),
        agent_id: 'agent1'
      };

      await expect(manager.addMessage('test-session-1', message))
        .rejects.toThrow('Cannot add message to paused session');
    });
  });

  describe('cleanup', () => {
    it('should clean up old archived sessions', async () => {
      // Use fake timers to control time
      vi.useFakeTimers();
      
      // Set initial time
      const initialTime = new Date('2025-01-01T12:00:00Z');
      vi.setSystemTime(initialTime);
      
      // Create and archive a session
      await manager.createGroupChat({
        ...mockConfig,
        id: 'cleanup-session'
      });
      await manager.archiveSession('cleanup-session');

      const cleanupListener = vi.fn();
      manager.on('sessions-cleaned', cleanupListener);

      // Move time forward more than 0 days
      vi.setSystemTime(new Date('2025-01-02T12:00:00Z')); // 1 day later

      // Clean up sessions older than 0 days (should remove all)
      await manager.cleanup(0);

      expect(cleanupListener).toHaveBeenCalledWith({
        removedCount: 1,
        cutoffTime: expect.any(Date)
      });

      // Should not be able to get summary of cleaned session
      const summary = manager.getSessionSummary('cleanup-session');
      expect(summary).toBeNull();
      
      vi.useRealTimers();
    });
  });
});