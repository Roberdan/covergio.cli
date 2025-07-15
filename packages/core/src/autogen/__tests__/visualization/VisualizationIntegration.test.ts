/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConversationHistory } from '../../visualization/ConversationHistory';
import { ConversationVisualizer } from '../../visualization/ConversationVisualizer';
import { VisualizationIntegration, VisualizationRequest } from '../../visualization/VisualizationIntegration';
import { CollaborationPattern, ConversationMessage } from '../../types';

describe('VisualizationIntegration', () => {
  let integration: VisualizationIntegration;
  let history: ConversationHistory;
  let visualizer: ConversationVisualizer;

  const mockParticipants = [
    { agentName: 'agent-1', role: 'moderator', capabilities: ['analysis'] },
    { agentName: 'agent-2', role: 'specialist', capabilities: ['data'] },
    { agentName: 'agent-3', role: 'participant', capabilities: ['support'] }
  ];

  beforeEach(() => {
    history = new ConversationHistory({
      maxSessions: 10,
      enableRealTimeAnalysis: false
    });
    
    visualizer = new ConversationVisualizer({
      layout: { algorithm: 'force', nodeSpacing: 50, edgeLength: 100 },
      animation: { enabled: false }
    });

    integration = new VisualizationIntegration(history, visualizer, undefined, {
      enableRealTimeUpdates: false, // Disable for testing
      autoCreateTimelines: true,
      updateInterval: 1000
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Initialization', () => {
    it('should initialize a conversation session with visualization', async () => {
      const sessionId = 'test-session-1';
      const pattern = CollaborationPattern.CONSULTATION;

      const session = await integration.initializeSession(sessionId, pattern, mockParticipants);

      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.pattern).toBe(pattern);
      expect(session.participants).toHaveLength(3);
      expect(session.status).toBe('active');
    });

    it('should emit session-initialized event', async () => {
      const eventListener = vi.fn();
      integration.on('session-initialized', eventListener);

      const sessionId = 'test-session-2';
      await integration.initializeSession(sessionId, CollaborationPattern.SEQUENTIAL, mockParticipants);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId,
        pattern: CollaborationPattern.SEQUENTIAL,
        participantCount: 3,
        timestamp: expect.any(Date)
      });
    });

    it('should auto-create timeline visualization when configured', async () => {
      const sessionId = 'test-session-3';
      await integration.initializeSession(sessionId, CollaborationPattern.BRAINSTORM, mockParticipants);

      // Wait a moment for async visualization creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const visualizations = integration.getSessionVisualizations(sessionId);
      expect(visualizations.length).toBeGreaterThan(0);
      expect(visualizations.some(v => v.visualizations.timeline)).toBe(true);
    });
  });

  describe('Turn Processing', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session-turns';
      await integration.initializeSession(sessionId, CollaborationPattern.CONSULTATION, mockParticipants);
    });

    it('should process conversation turns', async () => {
      const message: ConversationMessage = {
        role: 'assistant',
        content: 'Let me analyze this problem',
        timestamp: new Date().toISOString(),
        agentId: 'agent-1'
      };

      const turn = await integration.processTurn(sessionId, message, {
        toolsUsed: ['analysis-tool'],
        responseTime: 1500
      });

      expect(turn).toBeDefined();
      expect(turn.message.agentId).toBe('agent-1');
      expect(turn.metadata.toolsUsed).toContain('analysis-tool');
      expect(turn.metadata.responseTime).toBe(1500);
    });

    it('should emit turn-processed event', async () => {
      const eventListener = vi.fn();
      integration.on('turn-processed', eventListener);

      const message: ConversationMessage = {
        // id: 'msg-2',
        agentId: 'agent-2',
        role: 'assistant',
        content: 'Here is the data analysis',
        timestamp: new Date().toISOString()
      };

      await integration.processTurn(sessionId, message);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId,
        turnId: expect.any(String),
        agentId: 'agent-2',
        sequenceNumber: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });

    it('should handle multiple turns in sequence', async () => {
      const messages = [
        { id: 'msg-1', agentId: 'agent-1', role: 'assistant' as const, content: 'First message', timestamp: new Date().toISOString() },
        { id: 'msg-2', agentId: 'agent-2', role: 'assistant' as const, content: 'Second message', timestamp: new Date().toISOString() },
        { id: 'msg-3', agentId: 'agent-3', role: 'assistant' as const, content: 'Third message', timestamp: new Date().toISOString() }
      ];

      const turns = [];
      for (const message of messages) {
        const turn = await integration.processTurn(sessionId, message);
        turns.push(turn);
      }

      expect(turns).toHaveLength(3);
      expect(turns[0].sequenceNumber).toBe(1);
      expect(turns[1].sequenceNumber).toBe(2);
      expect(turns[2].sequenceNumber).toBe(3);
    });
  });

  describe('Visualization Requests', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session-viz';
      await integration.initializeSession(sessionId, CollaborationPattern.DEBATE, mockParticipants);
      
      // Add some turns for visualization
      const messages = [
        { id: 'msg-1', agentId: 'agent-1', role: 'assistant' as const, content: 'Opening statement', timestamp: new Date().toISOString() },
        { id: 'msg-2', agentId: 'agent-2', role: 'assistant' as const, content: 'Data analysis', timestamp: new Date().toISOString() },
        { id: 'msg-3', agentId: 'agent-3', role: 'assistant' as const, content: 'Supporting evidence', timestamp: new Date().toISOString() }
      ];

      for (const message of messages) {
        await integration.processTurn(sessionId, message);
      }
    });

    it('should create timeline visualization on request', async () => {
      const request: VisualizationRequest = {
        id: 'viz-req-1',
        sessionId,
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      const response = await integration.requestVisualization(request);

      expect(response.requestId).toBe(request.id);
      expect(response.sessionId).toBe(sessionId);
      expect(response.visualizations.timeline).toBeDefined();
      expect(response.visualizations.timeline?.tracks.length).toBeGreaterThan(0);
      expect(response.metadata.participantCount).toBe(3);
    });

    it('should create network visualization on request', async () => {
      const request: VisualizationRequest = {
        id: 'viz-req-2',
        sessionId,
        type: 'network',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      const response = await integration.requestVisualization(request);

      expect(response.visualizations.network).toBeDefined();
      expect(response.visualizations.network?.agents.length).toBe(3);
      expect(response.visualizations.network?.interactions.length).toBeGreaterThan(0);
    });

    it('should create flow visualization on request', async () => {
      const request: VisualizationRequest = {
        id: 'viz-req-3',
        sessionId,
        type: 'flow',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      const response = await integration.requestVisualization(request);

      expect(response.visualizations.flow).toBeDefined();
      expect(response.visualizations.flow?.phases.length).toBeGreaterThan(0);
    });

    it('should create all visualizations when type is "all"', async () => {
      const request: VisualizationRequest = {
        id: 'viz-req-4',
        sessionId,
        type: 'all',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      const response = await integration.requestVisualization(request);

      expect(response.visualizations.timeline).toBeDefined();
      expect(response.visualizations.flow).toBeDefined();
      expect(response.visualizations.network).toBeDefined();
      expect(response.visualizations.graph).toBeDefined();
    });

    it('should apply time range filters', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      const request: VisualizationRequest = {
        id: 'viz-req-5',
        sessionId,
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date(),
        filters: {
          timeRange: {
            start: oneMinuteAgo,
            end: now
          }
        }
      };

      const response = await integration.requestVisualization(request);
      expect(response.visualizations.timeline).toBeDefined();
    });

    it('should apply participant filters', async () => {
      const request: VisualizationRequest = {
        id: 'viz-req-6',
        sessionId,
        type: 'network',
        requestedBy: 'user-1',
        timestamp: new Date(),
        filters: {
          participants: ['agent-1', 'agent-2']
        }
      };

      const response = await integration.requestVisualization(request);
      expect(response.visualizations.network).toBeDefined();
      expect(response.visualizations.network?.agents.length).toBeLessThanOrEqual(2);
    });

    it('should emit visualization-created event', async () => {
      const eventListener = vi.fn();
      integration.on('visualization-created', eventListener);

      const request: VisualizationRequest = {
        id: 'viz-req-7',
        sessionId,
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      await integration.requestVisualization(request);

      expect(eventListener).toHaveBeenCalledWith({
        requestId: request.id,
        sessionId,
        type: 'timeline',
        processingTime: expect.any(Number),
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Session Subscriptions', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session-sub';
      await integration.initializeSession(sessionId, CollaborationPattern.CONSULTATION, mockParticipants);
    });

    it('should manage session subscriptions', () => {
      integration.subscribeToSession(sessionId, 'subscriber-1');
      integration.subscribeToSession(sessionId, 'subscriber-2');

      const analytics = integration.getSessionAnalytics(sessionId);
      expect(analytics.subscribers).toBe(2);

      integration.unsubscribeFromSession(sessionId, 'subscriber-1');
      const updatedAnalytics = integration.getSessionAnalytics(sessionId);
      expect(updatedAnalytics.subscribers).toBe(1);
    });

    it('should emit subscription events', () => {
      const addedListener = vi.fn();
      const removedListener = vi.fn();
      
      integration.on('subscription-added', addedListener);
      integration.on('subscription-removed', removedListener);

      integration.subscribeToSession(sessionId, 'subscriber-1');
      expect(addedListener).toHaveBeenCalledWith({
        sessionId,
        subscriberId: 'subscriber-1',
        totalSubscribers: 1,
        timestamp: expect.any(Date)
      });

      integration.unsubscribeFromSession(sessionId, 'subscriber-1');
      expect(removedListener).toHaveBeenCalledWith({
        sessionId,
        subscriberId: 'subscriber-1',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Session Analytics', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session-analytics';
      await integration.initializeSession(sessionId, CollaborationPattern.DEBATE, mockParticipants);
      
      // Add visualization
      const request: VisualizationRequest = {
        id: 'viz-analytics',
        sessionId,
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date()
      };
      await integration.requestVisualization(request);
    });

    it('should provide session analytics', () => {
      integration.subscribeToSession(sessionId, 'subscriber-1');

      const analytics = integration.getSessionAnalytics(sessionId);

      expect(analytics.session).toBeDefined();
      expect(analytics.session?.id).toBe(sessionId);
      expect(analytics.visualizations.count).toBeGreaterThan(0);
      expect(analytics.visualizations.types).toContain('timeline');
      expect(analytics.subscribers).toBe(1);
      expect(analytics.realTimeEnabled).toBe(false); // Disabled in test config
    });

    it('should track visualization generation times', () => {
      const analytics = integration.getSessionAnalytics(sessionId);
      expect(analytics.visualizations.lastGenerated).toBeInstanceOf(Date);
    });
  });

  describe('Session Completion', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = 'test-session-complete';
      await integration.initializeSession(sessionId, CollaborationPattern.SEQUENTIAL, mockParticipants);
    });

    it('should complete session and generate final visualizations', async () => {
      await integration.completeSession(sessionId);

      const session = history.getSession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.endTime).toBeDefined();
    });

    it('should emit session-completed event', async () => {
      const eventListener = vi.fn();
      integration.on('session-completed', eventListener);

      await integration.completeSession(sessionId);

      expect(eventListener).toHaveBeenCalledWith({
        sessionId,
        timestamp: expect.any(Date)
      });
    });

    it('should handle completion of non-existent session', async () => {
      await expect(integration.completeSession('non-existent-session'))
        .rejects.toThrow('Session non-existent-session not found');
    });
  });

  describe('Export Functionality', () => {
    let sessionId: string;
    let visualizationResponse: any;

    beforeEach(async () => {
      sessionId = 'test-session-export';
      await integration.initializeSession(sessionId, CollaborationPattern.BRAINSTORM, mockParticipants);
      
      const request: VisualizationRequest = {
        id: 'viz-export',
        sessionId,
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date()
      };
      
      visualizationResponse = await integration.requestVisualization(request);
    });

    it('should export visualization data', async () => {
      const result = await integration.exportVisualization(
        visualizationResponse.requestId,
        'json'
      );

      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should emit visualization-exported event', async () => {
      const eventListener = vi.fn();
      integration.on('visualization-exported', eventListener);

      await integration.exportVisualization(
        visualizationResponse.requestId,
        'json'
      );

      expect(eventListener).toHaveBeenCalledWith({
        visualizationId: visualizationResponse.requestId,
        format: 'json',
        type: 'timeline',
        sessionId,
        timestamp: expect.any(Date)
      });
    });

    it('should handle export of non-existent visualization', async () => {
      await expect(integration.exportVisualization('non-existent', 'json'))
        .rejects.toThrow('Visualization non-existent not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle session initialization errors', async () => {
      const eventListener = vi.fn();
      integration.on('session-initialization-error', eventListener);

      // Use a null sessionId to trigger error  
      await expect(integration.initializeSession('', CollaborationPattern.CONSULTATION, mockParticipants))
        .rejects.toThrow();

      expect(eventListener).toHaveBeenCalled();
    });

    it('should handle turn processing errors', async () => {
      const eventListener = vi.fn();
      integration.on('turn-processing-error', eventListener);

      const invalidMessage = {
        id: 'invalid-msg',
        agentId: '',
        role: 'assistant' as const,
        content: '',
        timestamp: 'invalid-timestamp'
      };

      await expect(integration.processTurn('non-existent-session', invalidMessage))
        .rejects.toThrow();

      expect(eventListener).toHaveBeenCalled();
    });

    it('should handle visualization request errors', async () => {
      const eventListener = vi.fn();
      integration.on('visualization-error', eventListener);

      const request: VisualizationRequest = {
        id: 'error-viz',
        sessionId: 'non-existent-session',
        type: 'timeline',
        requestedBy: 'user-1',
        timestamp: new Date()
      };

      await expect(integration.requestVisualization(request))
        .rejects.toThrow();

      expect(eventListener).toHaveBeenCalled();
    });
  });
});