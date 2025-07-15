/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Conversation Visualization and History Tracking Module
 * 
 * This module provides comprehensive visualization and history tracking capabilities
 * for multi-agent conversations, including timeline, flow, network, and hierarchy
 * visualizations with real-time updates and export functionality.
 */

// Core visualization components
export { ConversationHistory } from './ConversationHistory';
export { ConversationVisualizer } from './ConversationVisualizer';
export { VisualizationIntegration } from './VisualizationIntegration';

// Types and interfaces
export type {
  // ConversationHistory types
  ConversationTurn,
  ConversationThread,
  ConversationFlow,
  ConversationSession,
  ConversationStatistics,
  ConversationExport,
  HistoryQuery,

  // ConversationVisualizer types
  VisualizationNode,
  VisualizationEdge,
  VisualizationGraph,
  VisualizationConfig,
  TimelineVisualization,
  FlowVisualization,
  NetworkVisualization,

  // VisualizationIntegration types
  VisualizationIntegrationConfig,
  VisualizationRequest,
  VisualizationResponse
} from './ConversationHistory';

export type {
  VisualizationNode as VizNode,
  VisualizationEdge as VizEdge,
  VisualizationGraph as VizGraph,
  VisualizationConfig as VizConfig,
  TimelineVisualization as Timeline,
  FlowVisualization as Flow,
  NetworkVisualization as Network
} from './ConversationVisualizer';

export type {
  VisualizationIntegrationConfig as IntegrationConfig,
  VisualizationRequest as VizRequest,
  VisualizationResponse as VizResponse
} from './VisualizationIntegration';

/**
 * Factory function to create a complete visualization system
 */
export function createVisualizationSystem(config?: {
  history?: {
    maxSessions?: number;
    maxTurnsPerSession?: number;
    retentionDays?: number;
    enableRealTimeAnalysis?: boolean;
  };
  visualizer?: {
    layout?: {
      algorithm?: 'force' | 'hierarchy' | 'circular' | 'grid' | 'timeline';
      nodeSpacing?: number;
      edgeLength?: number;
    };
    animation?: {
      enabled?: boolean;
      duration?: number;
    };
  };
  integration?: {
    enableRealTimeUpdates?: boolean;
    autoCreateTimelines?: boolean;
    autoCreateNetworks?: boolean;
    updateInterval?: number;
  };
}) {
  const history = new ConversationHistory(config?.history);
  const visualizer = new ConversationVisualizer(config?.visualizer);
  const integration = new VisualizationIntegration(
    history,
    visualizer,
    undefined,
    config?.integration
  );

  return {
    history,
    visualizer,
    integration,

    // Convenience methods
    async createSession(sessionId: string, pattern: any, participants: any[]) {
      return integration.initializeSession(sessionId, pattern, participants);
    },

    async addTurn(sessionId: string, message: any, metadata?: any) {
      return integration.processTurn(sessionId, message, metadata);
    },

    async generateVisualization(sessionId: string, type: 'timeline' | 'flow' | 'network' | 'hierarchy' | 'all') {
      const request = {
        id: `${type}_${sessionId}_${Date.now()}`,
        sessionId,
        type,
        requestedBy: 'system',
        timestamp: new Date()
      };
      return integration.requestVisualization(request);
    },

    async exportVisualization(visualizationId: string, format: 'json' | 'svg' | 'png' | 'pdf') {
      return integration.exportVisualization(visualizationId, format);
    },

    getSessionAnalytics(sessionId: string) {
      return integration.getSessionAnalytics(sessionId);
    },

    async completeSession(sessionId: string) {
      return integration.completeSession(sessionId);
    }
  };
}

/**
 * Default configuration presets for different use cases
 */
export const VisualizationPresets = {
  /**
   * Lightweight configuration for basic timeline tracking
   */
  BASIC: {
    history: {
      maxSessions: 100,
      enableRealTimeAnalysis: false
    },
    visualizer: {
      animation: { enabled: false }
    },
    integration: {
      enableRealTimeUpdates: false,
      autoCreateTimelines: true,
      autoCreateNetworks: false
    }
  },

  /**
   * Full-featured configuration for comprehensive analysis
   */
  COMPREHENSIVE: {
    history: {
      maxSessions: 1000,
      enableRealTimeAnalysis: true
    },
    visualizer: {
      animation: { enabled: true, duration: 1000 }
    },
    integration: {
      enableRealTimeUpdates: true,
      autoCreateTimelines: true,
      autoCreateNetworks: true,
      updateInterval: 30000
    }
  },

  /**
   * Performance-optimized configuration for high-volume scenarios
   */
  HIGH_PERFORMANCE: {
    history: {
      maxSessions: 500,
      enableRealTimeAnalysis: false,
      retentionDays: 30
    },
    visualizer: {
      animation: { enabled: false },
      layout: { nodeSpacing: 50, edgeLength: 75 }
    },
    integration: {
      enableRealTimeUpdates: false,
      autoCreateTimelines: false,
      autoCreateNetworks: false,
      maxVisualizationsPerSession: 5
    }
  },

  /**
   * Real-time configuration for live monitoring
   */
  REAL_TIME: {
    history: {
      maxSessions: 200,
      enableRealTimeAnalysis: true
    },
    visualizer: {
      animation: { enabled: true, duration: 500 }
    },
    integration: {
      enableRealTimeUpdates: true,
      autoCreateTimelines: true,
      autoCreateNetworks: true,
      updateInterval: 10000
    }
  }
};

/**
 * Utility functions for visualization data processing
 */
export const VisualizationUtils = {
  /**
   * Calculate conversation complexity score
   */
  calculateComplexity(session: ConversationSession): number {
    let complexity = 0;
    
    // Base complexity from turn count
    complexity += Math.log(session.statistics.totalTurns + 1) * 2;
    
    // Participant diversity
    complexity += session.statistics.participantCount * 1.5;
    
    // Tool usage
    complexity += Math.log(session.statistics.toolUsageCount + 1) * 1.5;
    
    // Context references
    complexity += Math.log(session.statistics.contextReferences + 1) * 1.2;
    
    // Thread count and branching
    complexity += session.threads.length * 0.8;
    
    return Math.min(complexity, 10); // Cap at 10
  },

  /**
   * Extract key insights from conversation flow
   */
  extractInsights(session: ConversationSession): {
    dominantParticipant: string | null;
    mostActivePhase: string | null;
    averageResponseTime: number;
    toolUsageRate: number;
    engagementScore: number;
  } {
    let dominantParticipant = null;
    let maxTurns = 0;
    
    for (const metric of session.flow.participationMetrics) {
      if (metric.turnCount > maxTurns) {
        maxTurns = metric.turnCount;
        dominantParticipant = metric.agentId;
      }
    }

    const mostActivePhase = session.flow.phases.reduce((max, phase) => 
      phase.turnCount > max.turnCount ? phase : max
    ).name;

    const averageResponseTime = session.flow.participationMetrics.reduce(
      (sum, metric) => sum + metric.averageResponseTime, 0
    ) / session.flow.participationMetrics.length;

    const toolUsageRate = session.statistics.toolUsageCount / session.statistics.totalTurns;
    
    const engagementScore = Math.min(
      (session.statistics.totalTurns / session.statistics.participantCount) / 10, 1
    );

    return {
      dominantParticipant,
      mostActivePhase,
      averageResponseTime,
      toolUsageRate,
      engagementScore
    };
  },

  /**
   * Format visualization data for external consumption
   */
  formatForExport(visualization: any, format: 'summary' | 'detailed' = 'summary'): any {
    if (format === 'summary') {
      return {
        id: visualization.id,
        type: visualization.type || 'unknown',
        participantCount: visualization.agents?.length || visualization.tracks?.length || 0,
        eventCount: visualization.interactions?.length || visualization.events?.length || 0,
        timeSpan: visualization.timeRange ? {
          start: visualization.timeRange.start,
          end: visualization.timeRange.end
        } : null,
        generatedAt: new Date()
      };
    }

    return visualization;
  }
};