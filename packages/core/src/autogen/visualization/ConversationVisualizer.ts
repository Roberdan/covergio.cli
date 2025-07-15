/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ConversationSession, ConversationTurn, ConversationThread, ConversationFlow } from './ConversationHistory';
import { CollaborationPattern } from '../types';

/**
 * Visualization node representing an agent or event
 */
export interface VisualizationNode {
  id: string;
  type: 'agent' | 'turn' | 'tool' | 'context' | 'phase';
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color: string;
  metadata: {
    agentId?: string;
    turnId?: string;
    timestamp?: Date;
    importance?: number;
    connections?: string[];
  };
}

/**
 * Visualization edge representing relationships
 */
export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  type: 'conversation' | 'tool_use' | 'context_reference' | 'interruption' | 'branch';
  label?: string;
  weight: number;
  style: {
    color: string;
    width: number;
    dashPattern?: number[];
  };
  metadata: {
    timestamp?: Date;
    duration?: number;
    data?: any;
  };
}

/**
 * Complete visualization graph
 */
export interface VisualizationGraph {
  id: string;
  sessionId: string;
  type: 'timeline' | 'flow' | 'network' | 'hierarchy';
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  layout: {
    algorithm: 'force' | 'hierarchy' | 'circular' | 'grid' | 'timeline';
    bounds: { width: number; height: number };
    spacing: { x: number; y: number };
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    complexity: number;
    participantCount: number;
    timeSpan: number;
  };
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  layout: {
    algorithm: VisualizationGraph['layout']['algorithm'];
    nodeSpacing: number;
    edgeLength: number;
    forceStrength?: number;
    iterations?: number;
  };
  style: {
    nodeColors: Record<string, string>;
    edgeColors: Record<string, string>;
    fontSize: number;
    nodeSize: { min: number; max: number };
    edgeWidth: { min: number; max: number };
  };
  filters: {
    showAllTurns?: boolean;
    showToolUsage?: boolean;
    showContextReferences?: boolean;
    timeRange?: { start: Date; end: Date };
    participants?: string[];
  };
  animation: {
    enabled: boolean;
    duration: number;
    playbackSpeed: number;
    autoPlay: boolean;
  };
}

/**
 * Timeline visualization data
 */
export interface TimelineVisualization {
  id: string;
  sessionId: string;
  tracks: {
    id: string;
    label: string;
    type: 'agent' | 'phase' | 'tool' | 'context';
    events: {
      id: string;
      start: Date;
      end?: Date;
      label: string;
      description: string;
      color: string;
      metadata: any;
    }[];
  }[];
  timeRange: { start: Date; end: Date };
  markers: {
    timestamp: Date;
    label: string;
    type: 'phase_change' | 'interruption' | 'tool_use' | 'milestone';
    color: string;
  }[];
}

/**
 * Flow diagram visualization
 */
export interface FlowVisualization {
  id: string;
  sessionId: string;
  phases: {
    id: string;
    name: string;
    participants: string[];
    startTime: Date;
    endTime?: Date;
    position: { x: number; y: number };
    size: { width: number; height: number };
    connections: string[];
  }[];
  transitions: {
    from: string;
    to: string;
    trigger: string;
    timestamp: Date;
    participants: string[];
  }[];
}

/**
 * Network visualization for agent interactions
 */
export interface NetworkVisualization {
  id: string;
  sessionId: string;
  agents: {
    id: string;
    name: string;
    position: { x: number; y: number };
    size: number;
    color: string;
    metadata: {
      turnCount: number;
      averageResponseTime: number;
      toolUsage: number;
      centrality: number;
    };
  }[];
  interactions: {
    source: string;
    target: string;
    weight: number;
    type: 'direct' | 'tool_mediated' | 'context_shared';
    count: number;
    lastInteraction: Date;
  }[];
}

/**
 * Conversation visualizer for creating various visual representations
 */
export class ConversationVisualizer extends EventEmitter {
  private graphs: Map<string, VisualizationGraph> = new Map();
  private timelines: Map<string, TimelineVisualization> = new Map();
  private flows: Map<string, FlowVisualization> = new Map();
  private networks: Map<string, NetworkVisualization> = new Map();

  private defaultConfig: VisualizationConfig = {
    layout: {
      algorithm: 'force',
      nodeSpacing: 100,
      edgeLength: 150,
      forceStrength: 0.5,
      iterations: 100
    },
    style: {
      nodeColors: {
        agent: '#4A90E2',
        turn: '#7ED321',
        tool: '#F5A623',
        context: '#BD10E0',
        phase: '#50E3C2'
      },
      edgeColors: {
        conversation: '#9013FE',
        tool_use: '#FF6D00',
        context_reference: '#00BCD4',
        interruption: '#F44336',
        branch: '#4CAF50'
      },
      fontSize: 12,
      nodeSize: { min: 20, max: 80 },
      edgeWidth: { min: 1, max: 5 }
    },
    filters: {
      showAllTurns: true,
      showToolUsage: true,
      showContextReferences: true
    },
    animation: {
      enabled: true,
      duration: 1000,
      playbackSpeed: 1.0,
      autoPlay: false
    }
  };

  constructor(private config: Partial<VisualizationConfig> = {}) {
    super();
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Create a timeline visualization
   */
  async createTimelineVisualization(
    session: ConversationSession,
    config?: Partial<VisualizationConfig>
  ): Promise<TimelineVisualization> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const timelineId = `timeline_${session.id}_${Date.now()}`;

    const timeline: TimelineVisualization = {
      id: timelineId,
      sessionId: session.id,
      tracks: [],
      timeRange: {
        start: session.startTime,
        end: session.endTime || new Date()
      },
      markers: []
    };

    // Create agent tracks
    const agentTracks = new Map<string, TimelineVisualization['tracks'][0]>();
    for (const participant of session.participants) {
      const track = {
        id: `agent_${participant.agentName}`,
        label: participant.agentName,
        type: 'agent' as const,
        events: []
      };
      agentTracks.set(participant.agentName, track);
      timeline.tracks.push(track);
    }

    // Add turn events to agent tracks
    for (const turn of session.turns) {
      const agentTrack = agentTracks.get(turn.message.agentId);
      if (agentTrack) {
        const turnStart = new Date(turn.message.timestamp);
        const turnEnd = new Date(turnStart.getTime() + turn.turnDuration);

        agentTrack.events.push({
          id: turn.id,
          start: turnStart,
          end: turnEnd,
          label: `Turn ${turn.sequenceNumber}`,
          description: this.truncateText(turn.message.content, 100),
          color: this.getAgentColor(turn.message.agentId),
          metadata: {
            turnId: turn.id,
            tokenCount: turn.metadata.tokenCount,
            toolsUsed: turn.metadata.toolsUsed
          }
        });
      }
    }

    // Create phase track
    if (session.flow.phases.length > 0) {
      const phaseTrack = {
        id: 'phases',
        label: 'Collaboration Phases',
        type: 'phase' as const,
        events: []
      };

      for (const phase of session.flow.phases) {
        phaseTrack.events.push({
          id: `phase_${phase.name}`,
          start: phase.startTime,
          end: phase.endTime || new Date(),
          label: phase.name,
          description: `${phase.participants.join(', ')} - ${phase.turnCount} turns`,
          color: finalConfig.style.nodeColors.phase,
          metadata: {
            participants: phase.participants,
            turnCount: phase.turnCount,
            keyEvents: phase.keyEvents
          }
        });
      }

      timeline.tracks.push(phaseTrack);
    }

    // Create tool usage track if enabled
    if (finalConfig.filters.showToolUsage) {
      const toolTrack = {
        id: 'tools',
        label: 'Tool Usage',
        type: 'tool' as const,
        events: []
      };

      for (const turn of session.turns) {
        if (turn.metadata.toolsUsed && turn.metadata.toolsUsed.length > 0) {
          const turnTime = new Date(turn.message.timestamp);
          
          for (const tool of turn.metadata.toolsUsed) {
            toolTrack.events.push({
              id: `tool_${turn.id}_${tool}`,
              start: turnTime,
              label: tool,
              description: `Used by ${turn.message.agentId}`,
              color: finalConfig.style.nodeColors.tool,
              metadata: {
                toolId: tool,
                agentId: turn.message.agentId,
                turnId: turn.id
              }
            });
          }
        }
      }

      if (toolTrack.events.length > 0) {
        timeline.tracks.push(toolTrack);
      }
    }

    // Add timeline markers for key events
    for (const event of session.flow.timeline) {
      if (event.event === 'phase_change' || event.event === 'interruption') {
        timeline.markers.push({
          timestamp: event.timestamp,
          label: event.event === 'phase_change' ? 'Phase Change' : 'Interruption',
          type: event.event,
          color: event.event === 'phase_change' ? '#2196F3' : '#F44336'
        });
      }
    }

    this.timelines.set(timelineId, timeline);

    this.emit('timeline-created', {
      timelineId,
      sessionId: session.id,
      trackCount: timeline.tracks.length,
      eventCount: timeline.tracks.reduce((sum, track) => sum + track.events.length, 0),
      timestamp: new Date()
    });

    return timeline;
  }

  /**
   * Create a flow visualization
   */
  async createFlowVisualization(
    session: ConversationSession,
    config?: Partial<VisualizationConfig>
  ): Promise<FlowVisualization> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const flowId = `flow_${session.id}_${Date.now()}`;

    const flow: FlowVisualization = {
      id: flowId,
      sessionId: session.id,
      phases: [],
      transitions: []
    };

    // Create phase nodes
    let x = 0;
    const y = 200;
    const phaseWidth = 200;
    const phaseHeight = 100;
    const spacing = 250;

    for (let i = 0; i < session.flow.phases.length; i++) {
      const phase = session.flow.phases[i];
      
      flow.phases.push({
        id: `phase_${i}`,
        name: phase.name,
        participants: phase.participants,
        startTime: phase.startTime,
        endTime: phase.endTime,
        position: { x, y },
        size: { width: phaseWidth, height: phaseHeight },
        connections: i < session.flow.phases.length - 1 ? [`phase_${i + 1}`] : []
      });

      x += spacing;
    }

    // Create transitions between phases
    for (let i = 0; i < session.flow.phases.length - 1; i++) {
      const currentPhase = session.flow.phases[i];
      const nextPhase = session.flow.phases[i + 1];

      flow.transitions.push({
        from: `phase_${i}`,
        to: `phase_${i + 1}`,
        trigger: 'phase_completion',
        timestamp: nextPhase.startTime,
        participants: this.getSharedParticipants(currentPhase.participants, nextPhase.participants)
      });
    }

    this.flows.set(flowId, flow);

    this.emit('flow-created', {
      flowId,
      sessionId: session.id,
      phaseCount: flow.phases.length,
      transitionCount: flow.transitions.length,
      timestamp: new Date()
    });

    return flow;
  }

  /**
   * Create a network visualization
   */
  async createNetworkVisualization(
    session: ConversationSession,
    config?: Partial<VisualizationConfig>
  ): Promise<NetworkVisualization> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const networkId = `network_${session.id}_${Date.now()}`;

    const network: NetworkVisualization = {
      id: networkId,
      sessionId: session.id,
      agents: [],
      interactions: []
    };

    // Create agent nodes
    const agentInteractions = new Map<string, Map<string, number>>();
    const agentMetrics = new Map<string, any>();

    // Initialize agent data
    for (const participant of session.participants) {
      const agentId = participant.agentName;
      agentInteractions.set(agentId, new Map());
      
      const metric = session.flow.participationMetrics.find(m => m.agentId === agentId);
      agentMetrics.set(agentId, {
        turnCount: metric?.turnCount || 0,
        averageResponseTime: metric?.averageResponseTime || 0,
        toolUsage: metric?.toolUsageCount || 0,
        centrality: 0
      });
    }

    // Analyze interactions between agents
    for (let i = 0; i < session.turns.length - 1; i++) {
      const currentTurn = session.turns[i];
      const nextTurn = session.turns[i + 1];
      
      if (currentTurn.message.agentId !== nextTurn.message.agentId) {
        const fromAgent = currentTurn.message.agentId;
        const toAgent = nextTurn.message.agentId;
        
        const fromMap = agentInteractions.get(fromAgent)!;
        fromMap.set(toAgent, (fromMap.get(toAgent) || 0) + 1);
      }
    }

    // Calculate centrality and positioning
    const agentIds = Array.from(agentMetrics.keys());
    const radius = 200;
    const centerX = 300;
    const centerY = 300;

    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const metrics = agentMetrics.get(agentId)!;
      
      // Calculate centrality based on interaction count
      let totalInteractions = 0;
      const agentMap = agentInteractions.get(agentId)!;
      for (const count of agentMap.values()) {
        totalInteractions += count;
      }
      
      metrics.centrality = totalInteractions / Math.max(session.turns.length, 1);

      // Position agents in a circle
      const angle = (2 * Math.PI * i) / agentIds.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      network.agents.push({
        id: agentId,
        name: agentId,
        position: { x, y },
        size: Math.max(30, Math.min(80, 30 + metrics.turnCount * 2)),
        color: this.getAgentColor(agentId),
        metadata: metrics
      });
    }

    // Create interaction edges
    for (const [fromAgent, toAgentMap] of agentInteractions) {
      for (const [toAgent, count] of toAgentMap) {
        if (count > 0) {
          network.interactions.push({
            source: fromAgent,
            target: toAgent,
            weight: count,
            type: 'direct',
            count,
            lastInteraction: this.getLastInteractionTime(session, fromAgent, toAgent)
          });
        }
      }
    }

    this.networks.set(networkId, network);

    this.emit('network-created', {
      networkId,
      sessionId: session.id,
      agentCount: network.agents.length,
      interactionCount: network.interactions.length,
      timestamp: new Date()
    });

    return network;
  }

  /**
   * Create a comprehensive visualization graph
   */
  async createVisualizationGraph(
    session: ConversationSession,
    type: VisualizationGraph['type'],
    config?: Partial<VisualizationConfig>
  ): Promise<VisualizationGraph> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const graphId = `graph_${type}_${session.id}_${Date.now()}`;

    const graph: VisualizationGraph = {
      id: graphId,
      sessionId: session.id,
      type,
      nodes: [],
      edges: [],
      layout: {
        algorithm: finalConfig.layout.algorithm,
        bounds: { width: 800, height: 600 },
        spacing: { x: finalConfig.layout.nodeSpacing, y: finalConfig.layout.nodeSpacing }
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        complexity: session.statistics.complexity,
        participantCount: session.statistics.participantCount,
        timeSpan: session.endTime ? 
          session.endTime.getTime() - session.startTime.getTime() : 
          Date.now() - session.startTime.getTime()
      }
    };

    switch (type) {
      case 'timeline':
        await this.createTimelineGraph(session, graph, finalConfig);
        break;
      case 'flow':
        await this.createFlowGraph(session, graph, finalConfig);
        break;
      case 'network':
        await this.createNetworkGraph(session, graph, finalConfig);
        break;
      case 'hierarchy':
        await this.createHierarchyGraph(session, graph, finalConfig);
        break;
    }

    this.graphs.set(graphId, graph);

    this.emit('graph-created', {
      graphId,
      sessionId: session.id,
      type,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      timestamp: new Date()
    });

    return graph;
  }

  /**
   * Export visualization data
   */
  async exportVisualization(
    visualizationId: string,
    format: 'json' | 'svg' | 'png' | 'pdf'
  ): Promise<{
    format: string;
    data: string | Buffer;
    metadata: any;
  }> {
    // This would typically interface with a visualization library
    // For now, return the data structure
    
    const graph = this.graphs.get(visualizationId);
    const timeline = this.timelines.get(visualizationId);
    const flow = this.flows.get(visualizationId);
    const network = this.networks.get(visualizationId);

    const data = graph || timeline || flow || network;
    
    if (!data) {
      throw new Error(`Visualization ${visualizationId} not found`);
    }

    const result = {
      format,
      data: JSON.stringify(data, null, 2),
      metadata: {
        exportTime: new Date(),
        visualizationId,
        type: graph?.type || 'timeline',
        complexity: graph?.metadata.complexity || 0
      }
    };

    this.emit('visualization-exported', {
      visualizationId,
      format,
      timestamp: new Date()
    });

    return result;
  }

  /**
   * Get all visualizations for a session
   */
  getSessionVisualizations(sessionId: string): {
    graphs: VisualizationGraph[];
    timelines: TimelineVisualization[];
    flows: FlowVisualization[];
    networks: NetworkVisualization[];
  } {
    return {
      graphs: Array.from(this.graphs.values()).filter(g => g.sessionId === sessionId),
      timelines: Array.from(this.timelines.values()).filter(t => t.sessionId === sessionId),
      flows: Array.from(this.flows.values()).filter(f => f.sessionId === sessionId),
      networks: Array.from(this.networks.values()).filter(n => n.sessionId === sessionId)
    };
  }

  /**
   * Private helper methods
   */
  private async createTimelineGraph(
    session: ConversationSession,
    graph: VisualizationGraph,
    config: VisualizationConfig
  ): Promise<void> {
    // Create timeline-based layout with turns positioned along time axis
    let x = 50;
    const y = 300;
    const timeStep = 100;

    for (const turn of session.turns) {
      graph.nodes.push({
        id: turn.id,
        type: 'turn',
        label: `${turn.message.agentId}: T${turn.sequenceNumber}`,
        position: { x, y },
        size: { width: 80, height: 40 },
        color: this.getAgentColor(turn.message.agentId),
        metadata: {
          agentId: turn.message.agentId,
          turnId: turn.id,
          timestamp: new Date(turn.message.timestamp),
          importance: this.calculateTurnImportance(turn)
        }
      });

      // Add edges to next turn
      if (x > 50) {
        const prevTurnIndex = session.turns.indexOf(turn) - 1;
        if (prevTurnIndex >= 0) {
          const prevTurn = session.turns[prevTurnIndex];
          graph.edges.push({
            id: `edge_${prevTurn.id}_${turn.id}`,
            source: prevTurn.id,
            target: turn.id,
            type: 'conversation',
            weight: 1,
            style: {
              color: config.style.edgeColors.conversation,
              width: 2
            },
            metadata: {
              timestamp: new Date(turn.message.timestamp),
              duration: turn.turnDuration
            }
          });
        }
      }

      x += timeStep;
    }
  }

  private async createFlowGraph(
    session: ConversationSession,
    graph: VisualizationGraph,
    config: VisualizationConfig
  ): Promise<void> {
    // Create phase-based flow diagram
    let x = 100;
    const y = 200;
    const phaseSpacing = 200;

    for (let i = 0; i < session.flow.phases.length; i++) {
      const phase = session.flow.phases[i];
      
      graph.nodes.push({
        id: `phase_${i}`,
        type: 'phase',
        label: phase.name,
        position: { x, y },
        size: { width: 150, height: 80 },
        color: config.style.nodeColors.phase,
        metadata: {
          timestamp: phase.startTime,
          importance: phase.turnCount / session.turns.length,
          connections: phase.participants
        }
      });

      if (i > 0) {
        graph.edges.push({
          id: `phase_edge_${i-1}_${i}`,
          source: `phase_${i-1}`,
          target: `phase_${i}`,
          type: 'conversation',
          weight: 1,
          style: {
            color: config.style.edgeColors.conversation,
            width: 3
          },
          metadata: {
            timestamp: phase.startTime
          }
        });
      }

      x += phaseSpacing;
    }
  }

  private async createNetworkGraph(
    session: ConversationSession,
    graph: VisualizationGraph,
    config: VisualizationConfig
  ): Promise<void> {
    // Create agent network with interaction strength
    const radius = 250;
    const centerX = 400;
    const centerY = 300;

    // Add agent nodes
    for (let i = 0; i < session.participants.length; i++) {
      const participant = session.participants[i];
      const angle = (2 * Math.PI * i) / session.participants.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const metric = session.flow.participationMetrics.find(m => m.agentId === participant.agentName);

      graph.nodes.push({
        id: participant.agentName,
        type: 'agent',
        label: participant.agentName,
        position: { x, y },
        size: { 
          width: Math.max(60, (metric?.turnCount || 0) * 3),
          height: Math.max(60, (metric?.turnCount || 0) * 3)
        },
        color: this.getAgentColor(participant.agentName),
        metadata: {
          agentId: participant.agentName,
          importance: metric?.dominanceScore || 0
        }
      });
    }

    // Add interaction edges
    for (let i = 0; i < session.turns.length - 1; i++) {
      const currentTurn = session.turns[i];
      const nextTurn = session.turns[i + 1];
      
      if (currentTurn.message.agentId !== nextTurn.message.agentId) {
        const edgeId = `interaction_${currentTurn.message.agentId}_${nextTurn.message.agentId}_${i}`;
        
        graph.edges.push({
          id: edgeId,
          source: currentTurn.message.agentId,
          target: nextTurn.message.agentId,
          type: 'conversation',
          weight: 1,
          style: {
            color: config.style.edgeColors.conversation,
            width: 2
          },
          metadata: {
            timestamp: new Date(nextTurn.message.timestamp),
            duration: nextTurn.turnDuration
          }
        });
      }
    }
  }

  private async createHierarchyGraph(
    session: ConversationSession,
    graph: VisualizationGraph,
    config: VisualizationConfig
  ): Promise<void> {
    // Create hierarchical view based on roles and participation
    const levels = new Map<string, number>();
    const positions = new Map<string, { x: number; y: number }>();

    // Assign levels based on roles
    for (const participant of session.participants) {
      let level = 0;
      switch (participant.role) {
        case 'moderator': level = 0; break;
        case 'specialist': level = 1; break;
        case 'participant': level = 2; break;
        default: level = 3;
      }
      levels.set(participant.agentName, level);
    }

    // Calculate positions
    const levelCounts = new Map<number, number>();
    for (const level of levels.values()) {
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }

    const levelOffsets = new Map<number, number>();
    for (const [level] of levelCounts) {
      levelOffsets.set(level, 0);
    }

    for (const [agentId, level] of levels) {
      const currentOffset = levelOffsets.get(level)!;
      const totalAtLevel = levelCounts.get(level)!;
      const spacing = 200;
      const startX = 400 - (totalAtLevel - 1) * spacing / 2;
      
      positions.set(agentId, {
        x: startX + currentOffset * spacing,
        y: 100 + level * 150
      });
      
      levelOffsets.set(level, currentOffset + 1);
    }

    // Add nodes
    for (const participant of session.participants) {
      const position = positions.get(participant.agentName)!;
      const metric = session.flow.participationMetrics.find(m => m.agentId === participant.agentName);
      
      graph.nodes.push({
        id: participant.agentName,
        type: 'agent',
        label: `${participant.agentName}\n(${participant.role})`,
        position,
        size: { width: 120, height: 60 },
        color: this.getRoleColor(participant.role),
        metadata: {
          agentId: participant.agentName,
          importance: metric?.dominanceScore || 0
        }
      });
    }

    // Add hierarchical edges based on communication patterns
    const interactions = this.analyzeInteractionPatterns(session);
    for (const [source, targets] of interactions) {
      for (const [target, weight] of targets) {
        if (weight > 1) { // Only show significant interactions
          graph.edges.push({
            id: `hierarchy_${source}_${target}`,
            source,
            target,
            type: 'conversation',
            weight,
            style: {
              color: config.style.edgeColors.conversation,
              width: Math.min(Math.max(weight / 2, 1), 5)
            },
            metadata: {}
          });
        }
      }
    }
  }

  private calculateTurnImportance(turn: ConversationTurn): number {
    let importance = 0;
    
    // Base importance
    importance += 0.1;
    
    // Tool usage increases importance
    if (turn.metadata.toolsUsed && turn.metadata.toolsUsed.length > 0) {
      importance += turn.metadata.toolsUsed.length * 0.3;
    }
    
    // Context references increase importance
    if (turn.metadata.contextReferences && turn.metadata.contextReferences.length > 0) {
      importance += turn.metadata.contextReferences.length * 0.2;
    }
    
    // Message length indicates importance
    const contentLength = turn.message.content.length;
    importance += Math.min(contentLength / 1000, 0.5);
    
    return Math.min(importance, 1);
  }

  private analyzeInteractionPatterns(session: ConversationSession): Map<string, Map<string, number>> {
    const interactions = new Map<string, Map<string, number>>();
    
    for (const participant of session.participants) {
      interactions.set(participant.agentName, new Map());
    }
    
    for (let i = 0; i < session.turns.length - 1; i++) {
      const currentTurn = session.turns[i];
      const nextTurn = session.turns[i + 1];
      
      if (currentTurn.message.agentId !== nextTurn.message.agentId) {
        const fromAgent = currentTurn.message.agentId;
        const toAgent = nextTurn.message.agentId;
        
        const fromMap = interactions.get(fromAgent);
        if (fromMap) {
          fromMap.set(toAgent, (fromMap.get(toAgent) || 0) + 1);
        }
      }
    }
    
    return interactions;
  }

  private getAgentColor(agentId: string): string {
    // Generate consistent color for agent based on ID hash
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  private getRoleColor(role: string): string {
    const roleColors = {
      'moderator': '#2196F3',
      'specialist': '#4CAF50',
      'participant': '#FF9800',
      'observer': '#9E9E9E'
    };
    return roleColors[role] || '#607D8B';
  }

  private getSharedParticipants(participants1: string[], participants2: string[]): string[] {
    return participants1.filter(p => participants2.includes(p));
  }

  private getLastInteractionTime(session: ConversationSession, agent1: string, agent2: string): Date {
    for (let i = session.turns.length - 1; i > 0; i--) {
      const turn = session.turns[i];
      const prevTurn = session.turns[i - 1];
      
      if ((turn.message.agentId === agent1 && prevTurn.message.agentId === agent2) ||
          (turn.message.agentId === agent2 && prevTurn.message.agentId === agent1)) {
        return new Date(turn.message.timestamp);
      }
    }
    
    return session.startTime;
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}