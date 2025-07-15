/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ConversationHistory, ConversationSession, ConversationTurn } from './ConversationHistory';
import { ConversationVisualizer, VisualizationGraph, TimelineVisualization, FlowVisualization, NetworkVisualization } from './ConversationVisualizer';
import { CollaborationPattern } from '../collaboration/CollaborationPattern';
import { GroupChatManager } from '../collaboration/GroupChatManager';
import { ConversationMessage } from '../types';
import { AgentParticipation } from '../collaboration/CollaborationPattern';

/**
 * Integration configuration
 */
export interface VisualizationIntegrationConfig {
  enableRealTimeUpdates: boolean;
  autoCreateTimelines: boolean;
  autoCreateNetworks: boolean;
  updateInterval: number; // milliseconds
  maxVisualizationsPerSession: number;
  enableExport: boolean;
  exportFormats: ('json' | 'svg' | 'png' | 'pdf')[];
}

/**
 * Visualization request
 */
export interface VisualizationRequest {
  id: string;
  sessionId: string;
  type: 'timeline' | 'flow' | 'network' | 'hierarchy' | 'all';
  requestedBy: string;
  timestamp: Date;
  config?: any;
  filters?: {
    timeRange?: { start: Date; end: Date };
    participants?: string[];
    includeTools?: boolean;
    includeContext?: boolean;
  };
}

/**
 * Visualization response
 */
export interface VisualizationResponse {
  requestId: string;
  sessionId: string;
  visualizations: {
    timeline?: TimelineVisualization;
    flow?: FlowVisualization;
    network?: NetworkVisualization;
    graph?: VisualizationGraph;
  };
  metadata: {
    generatedAt: Date;
    processingTime: number;
    complexity: number;
    participantCount: number;
    eventCount: number;
  };
  exportUrls?: Record<string, string>;
}

/**
 * Integration layer connecting conversation history and visualization systems
 */
export class VisualizationIntegration extends EventEmitter {
  private history: ConversationHistory;
  private visualizer: ConversationVisualizer;
  private groupChatManager?: GroupChatManager;
  
  private activeVisualizations: Map<string, VisualizationResponse> = new Map();
  private sessionSubscriptions: Map<string, Set<string>> = new Map(); // sessionId -> subscriberIds
  private realtimeUpdateTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private config: VisualizationIntegrationConfig = {
    enableRealTimeUpdates: true,
    autoCreateTimelines: true,
    autoCreateNetworks: false,
    updateInterval: 30000, // 30 seconds
    maxVisualizationsPerSession: 10,
    enableExport: true,
    exportFormats: ['json', 'svg']
  };

  constructor(
    history: ConversationHistory,
    visualizer: ConversationVisualizer,
    groupChatManager?: GroupChatManager,
    config?: Partial<VisualizationIntegrationConfig>
  ) {
    super();
    
    this.history = history;
    this.visualizer = visualizer;
    this.groupChatManager = groupChatManager;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.setupEventHandlers();
  }

  /**
   * Initialize visualization integration for a conversation session
   */
  async initializeSession(
    sessionId: string,
    pattern: CollaborationPattern,
    participants: AgentParticipation[]
  ): Promise<ConversationSession> {
    try {
      // Validate inputs
      if (!sessionId || sessionId.trim() === '') {
        throw new Error('Session ID cannot be empty');
      }
      
      // Create conversation session
      const session = await this.history.createSession(
        sessionId,
        `Multi-Agent Session ${sessionId}`,
        pattern,
        participants
      );

      // Set up real-time visualization updates if enabled
      if (this.config.enableRealTimeUpdates) {
        this.setupRealtimeUpdates(sessionId);
      }

      // Create initial visualizations if configured
      if (this.config.autoCreateTimelines) {
        await this.createVisualizationForSession(sessionId, 'timeline');
      }

      if (this.config.autoCreateNetworks) {
        await this.createVisualizationForSession(sessionId, 'network');
      }

      this.emit('session-initialized', {
        sessionId,
        pattern,
        participantCount: participants.length,
        timestamp: new Date()
      });

      return session;

    } catch (error) {
      this.emit('session-initialization-error', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Process a conversation turn and update visualizations
   */
  async processTurn(
    sessionId: string,
    message: ConversationMessage,
    metadata?: {
      toolsUsed?: string[];
      contextReferences?: string[];
      responseTime?: number;
      patternPhase?: string;
    }
  ): Promise<ConversationTurn> {
    try {
      const turn = await this.history.addTurn(sessionId, message, metadata);

      // Update active visualizations
      await this.updateActiveVisualizations(sessionId);

      this.emit('turn-processed', {
        sessionId,
        turnId: turn.id,
        agentId: message.agentId,
        sequenceNumber: turn.sequenceNumber,
        timestamp: new Date()
      });

      return turn;

    } catch (error) {
      this.emit('turn-processing-error', {
        sessionId,
        message,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Request visualization for a session
   */
  async requestVisualization(request: VisualizationRequest): Promise<VisualizationResponse> {
    const startTime = Date.now();

    try {
      const session = this.history.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session ${request.sessionId} not found`);
      }

      const response: VisualizationResponse = {
        requestId: request.id,
        sessionId: request.sessionId,
        visualizations: {},
        metadata: {
          generatedAt: new Date(),
          processingTime: 0,
          complexity: session.statistics.complexity,
          participantCount: session.statistics.participantCount,
          eventCount: session.statistics.totalTurns
        }
      };

      // Apply filters to session data if specified
      const filteredSession = this.applyFilters(session, request.filters);

      // Generate requested visualizations
      switch (request.type) {
        case 'timeline':
          response.visualizations.timeline = await this.visualizer.createTimelineVisualization(
            filteredSession,
            request.config
          );
          break;

        case 'flow':
          response.visualizations.flow = await this.visualizer.createFlowVisualization(
            filteredSession,
            request.config
          );
          break;

        case 'network':
          response.visualizations.network = await this.visualizer.createNetworkVisualization(
            filteredSession,
            request.config
          );
          break;

        case 'hierarchy':
          response.visualizations.graph = await this.visualizer.createVisualizationGraph(
            filteredSession,
            'hierarchy',
            request.config
          );
          break;

        case 'all':
          response.visualizations.timeline = await this.visualizer.createTimelineVisualization(
            filteredSession,
            request.config
          );
          response.visualizations.flow = await this.visualizer.createFlowVisualization(
            filteredSession,
            request.config
          );
          response.visualizations.network = await this.visualizer.createNetworkVisualization(
            filteredSession,
            request.config
          );
          response.visualizations.graph = await this.visualizer.createVisualizationGraph(
            filteredSession,
            'hierarchy',
            request.config
          );
          break;
      }

      // Generate export URLs if enabled
      if (this.config.enableExport) {
        response.exportUrls = await this.generateExportUrls(response);
      }

      response.metadata.processingTime = Date.now() - startTime;

      // Store active visualization
      this.activeVisualizations.set(request.id, response);

      this.emit('visualization-created', {
        requestId: request.id,
        sessionId: request.sessionId,
        type: request.type,
        processingTime: response.metadata.processingTime,
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      this.emit('visualization-error', {
        requestId: request.id,
        sessionId: request.sessionId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Subscribe to real-time visualization updates for a session
   */
  subscribeToSession(sessionId: string, subscriberId: string): void {
    if (!this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.set(sessionId, new Set());
    }
    
    this.sessionSubscriptions.get(sessionId)!.add(subscriberId);

    // Set up real-time updates if not already configured
    if (this.config.enableRealTimeUpdates && !this.realtimeUpdateTimers.has(sessionId)) {
      this.setupRealtimeUpdates(sessionId);
    }

    this.emit('subscription-added', {
      sessionId,
      subscriberId,
      totalSubscribers: this.sessionSubscriptions.get(sessionId)!.size,
      timestamp: new Date()
    });
  }

  /**
   * Unsubscribe from session updates
   */
  unsubscribeFromSession(sessionId: string, subscriberId: string): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (subscribers) {
      subscribers.delete(subscriberId);
      
      if (subscribers.size === 0) {
        this.sessionSubscriptions.delete(sessionId);
        
        // Stop real-time updates if no subscribers
        const timer = this.realtimeUpdateTimers.get(sessionId);
        if (timer) {
          clearInterval(timer);
          this.realtimeUpdateTimers.delete(sessionId);
        }
      }
    }

    this.emit('subscription-removed', {
      sessionId,
      subscriberId,
      timestamp: new Date()
    });
  }

  /**
   * Get current session visualizations
   */
  getSessionVisualizations(sessionId: string): VisualizationResponse[] {
    return Array.from(this.activeVisualizations.values())
      .filter(vis => vis.sessionId === sessionId);
  }

  /**
   * Export visualization data
   */
  async exportVisualization(
    visualizationId: string,
    format: 'json' | 'svg' | 'png' | 'pdf'
  ): Promise<{ data: string | Buffer; metadata: any }> {
    const visualization = this.activeVisualizations.get(visualizationId);
    if (!visualization) {
      throw new Error(`Visualization ${visualizationId} not found`);
    }

    // Find the actual visualization object to export
    let dataToExport: any = null;
    let visualizationType = '';

    if (visualization.visualizations.timeline) {
      dataToExport = visualization.visualizations.timeline;
      visualizationType = 'timeline';
    } else if (visualization.visualizations.flow) {
      dataToExport = visualization.visualizations.flow;
      visualizationType = 'flow';
    } else if (visualization.visualizations.network) {
      dataToExport = visualization.visualizations.network;
      visualizationType = 'network';
    } else if (visualization.visualizations.graph) {
      dataToExport = visualization.visualizations.graph;
      visualizationType = 'graph';
    }

    if (!dataToExport) {
      throw new Error(`No visualization data found for ${visualizationId}`);
    }

    const result = await this.visualizer.exportVisualization(dataToExport.id, format);

    this.emit('visualization-exported', {
      visualizationId,
      format,
      type: visualizationType,
      sessionId: visualization.sessionId,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Get session statistics with visualization metrics
   */
  getSessionAnalytics(sessionId: string): {
    session: ConversationSession | undefined;
    visualizations: {
      count: number;
      types: string[];
      lastGenerated: Date | null;
    };
    subscribers: number;
    realTimeEnabled: boolean;
  } {
    const session = this.history.getSession(sessionId);
    const visualizations = this.getSessionVisualizations(sessionId);
    const subscribers = this.sessionSubscriptions.get(sessionId)?.size || 0;
    const realTimeEnabled = this.realtimeUpdateTimers.has(sessionId);

    return {
      session,
      visualizations: {
        count: visualizations.length,
        types: this.getUniqueVisualizationTypes(visualizations),
        lastGenerated: this.getLastGenerationTime(visualizations)
      },
      subscribers,
      realTimeEnabled
    };
  }

  /**
   * Complete session and finalize visualizations
   */
  async completeSession(sessionId: string): Promise<void> {
    try {
      // Complete the conversation session
      await this.history.completeSession(sessionId);

      // Generate final visualizations
      await this.generateFinalVisualizations(sessionId);

      // Clean up real-time updates
      const timer = this.realtimeUpdateTimers.get(sessionId);
      if (timer) {
        clearInterval(timer);
        this.realtimeUpdateTimers.delete(sessionId);
      }

      // Notify subscribers
      this.notifySubscribers(sessionId, 'session-completed', {
        sessionId,
        finalVisualizationCount: this.getSessionVisualizations(sessionId).length,
        timestamp: new Date()
      });

      this.emit('session-completed', {
        sessionId,
        timestamp: new Date()
      });

    } catch (error) {
      this.emit('session-completion-error', {
        sessionId,
        error: error.message,
        timestamp: new Date()
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private setupEventHandlers(): void {
    // Listen to conversation history events
    this.history.on('turn-added', (event) => {
      this.handleTurnAdded(event);
    });

    this.history.on('session-completed', (event) => {
      this.handleSessionCompleted(event);
    });

    // Listen to visualizer events
    this.visualizer.on('timeline-created', (event) => {
      this.handleVisualizationCreated('timeline', event);
    });

    this.visualizer.on('network-created', (event) => {
      this.handleVisualizationCreated('network', event);
    });

    this.visualizer.on('flow-created', (event) => {
      this.handleVisualizationCreated('flow', event);
    });

    // Listen to group chat events if available
    if (this.groupChatManager) {
      this.groupChatManager.on('conversation-started', (event) => {
        this.handleGroupChatStarted(event);
      });

      this.groupChatManager.on('conversation-ended', (event) => {
        this.handleGroupChatEnded(event);
      });
    }
  }

  private async handleTurnAdded(event: any): Promise<void> {
    if (this.config.enableRealTimeUpdates) {
      // Schedule visualization update
      setTimeout(() => {
        this.updateActiveVisualizations(event.sessionId);
      }, 1000); // Small delay to batch multiple rapid turns
    }
  }

  private async handleSessionCompleted(event: any): Promise<void> {
    // Session is already completed in ConversationHistory, just clean up our integration
    const sessionId = event.sessionId;
    
    // Clean up real-time updates
    const timer = this.realtimeUpdateTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.realtimeUpdateTimers.delete(sessionId);
    }

    // Generate final visualizations without re-completing the session
    await this.generateFinalVisualizations(sessionId);

    // Notify subscribers
    this.notifySubscribers(sessionId, 'session-completed', {
      sessionId,
      finalVisualizationCount: this.getSessionVisualizations(sessionId).length,
      timestamp: new Date()
    });
  }

  private handleVisualizationCreated(type: string, event: any): void {
    this.notifySubscribers(event.sessionId, `${type}-updated`, {
      sessionId: event.sessionId,
      visualizationType: type,
      timestamp: new Date()
    });
  }

  private async handleGroupChatStarted(event: any): Promise<void> {
    // Automatically initialize visualization session for group chats
    if (event.sessionId && event.pattern && event.participants) {
      await this.initializeSession(event.sessionId, event.pattern, event.participants);
    }
  }

  private async handleGroupChatEnded(event: any): Promise<void> {
    if (event.sessionId) {
      await this.completeSession(event.sessionId);
    }
  }

  private setupRealtimeUpdates(sessionId: string): void {
    if (this.realtimeUpdateTimers.has(sessionId)) {
      return; // Already set up
    }

    const timer = setInterval(async () => {
      try {
        await this.updateActiveVisualizations(sessionId);
      } catch (error) {
        console.warn(`Failed to update visualizations for session ${sessionId}:`, error.message);
      }
    }, this.config.updateInterval);

    this.realtimeUpdateTimers.set(sessionId, timer);
  }

  private async updateActiveVisualizations(sessionId: string): Promise<void> {
    const visualizations = this.getSessionVisualizations(sessionId);
    
    for (const visualization of visualizations) {
      try {
        // Regenerate timeline if it exists
        if (visualization.visualizations.timeline) {
          const session = this.history.getSession(sessionId);
          if (session) {
            visualization.visualizations.timeline = await this.visualizer.createTimelineVisualization(session);
          }
        }

        // Regenerate network if it exists
        if (visualization.visualizations.network) {
          const session = this.history.getSession(sessionId);
          if (session) {
            visualization.visualizations.network = await this.visualizer.createNetworkVisualization(session);
          }
        }

        // Update metadata
        visualization.metadata.generatedAt = new Date();

      } catch (error) {
        console.warn(`Failed to update visualization ${visualization.requestId}:`, error.message);
      }
    }

    // Notify subscribers of updates
    this.notifySubscribers(sessionId, 'visualizations-updated', {
      sessionId,
      updateCount: visualizations.length,
      timestamp: new Date()
    });
  }

  private async createVisualizationForSession(
    sessionId: string,
    type: 'timeline' | 'network' | 'flow' | 'hierarchy'
  ): Promise<void> {
    const request: VisualizationRequest = {
      id: `auto_${type}_${sessionId}_${Date.now()}`,
      sessionId,
      type,
      requestedBy: 'system',
      timestamp: new Date()
    };

    try {
      await this.requestVisualization(request);
    } catch (error) {
      console.warn(`Failed to auto-create ${type} visualization for session ${sessionId}:`, error.message);
    }
  }

  private applyFilters(session: ConversationSession, filters?: VisualizationRequest['filters']): ConversationSession {
    if (!filters) return session;

    const filteredSession = { ...session };

    // Apply time range filter
    if (filters.timeRange) {
      filteredSession.turns = session.turns.filter(turn => {
        const turnTime = new Date(turn.message.timestamp);
        return turnTime >= filters.timeRange!.start && turnTime <= filters.timeRange!.end;
      });
    }

    // Apply participant filter
    if (filters.participants && filters.participants.length > 0) {
      filteredSession.turns = filteredSession.turns.filter(turn =>
        filters.participants!.includes(turn.message.agentId)
      );
      
      filteredSession.participants = session.participants.filter(p =>
        filters.participants!.includes(p.agentName)
      );
    }

    // Filter out tool usage if not included
    if (!filters.includeTools) {
      filteredSession.turns = filteredSession.turns.map(turn => ({
        ...turn,
        metadata: {
          ...turn.metadata,
          toolsUsed: undefined
        }
      }));
    }

    // Filter out context references if not included
    if (!filters.includeContext) {
      filteredSession.turns = filteredSession.turns.map(turn => ({
        ...turn,
        metadata: {
          ...turn.metadata,
          contextReferences: undefined
        }
      }));
    }

    return filteredSession;
  }

  private async generateExportUrls(response: VisualizationResponse): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};

    for (const format of this.config.exportFormats) {
      // In a real implementation, these would be actual URLs to export endpoints
      urls[format] = `/api/visualizations/${response.requestId}/export/${format}`;
    }

    return urls;
  }

  private async generateFinalVisualizations(sessionId: string): Promise<void> {
    const session = this.history.getSession(sessionId);
    if (!session) return;

    // Generate comprehensive final visualization set
    const finalRequest: VisualizationRequest = {
      id: `final_${sessionId}_${Date.now()}`,
      sessionId,
      type: 'all',
      requestedBy: 'system',
      timestamp: new Date()
    };

    try {
      await this.requestVisualization(finalRequest);
    } catch (error) {
      console.warn(`Failed to generate final visualizations for session ${sessionId}:`, error.message);
    }
  }

  private notifySubscribers(sessionId: string, eventType: string, data: any): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (subscribers && subscribers.size > 0) {
      this.emit('subscriber-notification', {
        sessionId,
        eventType,
        subscriberCount: subscribers.size,
        data,
        timestamp: new Date()
      });
    }
  }

  private getUniqueVisualizationTypes(visualizations: VisualizationResponse[]): string[] {
    const types = new Set<string>();
    
    for (const vis of visualizations) {
      if (vis.visualizations.timeline) types.add('timeline');
      if (vis.visualizations.flow) types.add('flow');
      if (vis.visualizations.network) types.add('network');
      if (vis.visualizations.graph) types.add('graph');
    }
    
    return Array.from(types);
  }

  private getLastGenerationTime(visualizations: VisualizationResponse[]): Date | null {
    if (visualizations.length === 0) return null;
    
    return visualizations.reduce((latest, vis) => {
      return vis.metadata.generatedAt > latest ? vis.metadata.generatedAt : latest;
    }, new Date(0));
  }
}