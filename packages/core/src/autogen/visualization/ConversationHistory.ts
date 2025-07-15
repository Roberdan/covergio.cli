/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import { ConversationMessage, CollaborationPattern } from '../types';
import { AgentParticipation } from '../collaboration/CollaborationPattern';

/**
 * Conversation turn with metadata
 */
export interface ConversationTurn {
  id: string;
  message: ConversationMessage;
  sequenceNumber: number;
  turnDuration: number;
  followupTurns?: string[];
  metadata: {
    patternPhase?: string;
    toolsUsed?: string[];
    contextReferences?: string[];
    responseTime?: number;
    tokenCount?: number;
  };
}

/**
 * Conversation thread representing a sequence of related turns
 */
export interface ConversationThread {
  id: string;
  sessionId: string;
  startTurnId: string;
  endTurnId?: string;
  turns: ConversationTurn[];
  participants: string[];
  topic: string;
  summary: string;
  status: 'active' | 'completed' | 'suspended';
  metadata: {
    branchedFrom?: string;
    mergedTo?: string;
    complexity: number;
    totalDuration: number;
    toolUsageCount: number;
    contextSize: number;
  };
}

/**
 * Conversation flow analysis
 */
export interface ConversationFlow {
  sessionId: string;
  pattern: CollaborationPattern;
  phases: {
    name: string;
    startTime: Date;
    endTime?: Date;
    participants: string[];
    turnCount: number;
    keyEvents: string[];
  }[];
  participationMetrics: {
    agentId: string;
    turnCount: number;
    averageResponseTime: number;
    toolUsageCount: number;
    dominanceScore: number; // 0-1 scale
  }[];
  timeline: {
    timestamp: Date;
    event: 'turn' | 'tool_use' | 'phase_change' | 'interruption' | 'error';
    details: any;
  }[];
}

/**
 * History query interface
 */
export interface HistoryQuery {
  sessionId?: string;
  agentId?: string;
  timeRange?: {
    from: Date;
    to: Date;
  };
  pattern?: CollaborationPattern;
  messageTypes?: ConversationMessage['role'][];
  includeMetadata?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'sequence' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Export format for conversation data
 */
export interface ConversationExport {
  format: 'json' | 'csv' | 'markdown' | 'xml';
  data: {
    sessions: ConversationSession[];
    statistics: ConversationStatistics;
    exportMetadata: {
      timestamp: Date;
      version: string;
      includePersonalData: boolean;
      anonymized: boolean;
    };
  };
}

/**
 * Conversation session with complete history
 */
export interface ConversationSession {
  id: string;
  name: string;
  pattern: CollaborationPattern;
  participants: AgentParticipation[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'archived';
  turns: ConversationTurn[];
  threads: ConversationThread[];
  flow: ConversationFlow;
  statistics: {
    totalTurns: number;
    totalDuration: number;
    averageTurnDuration: number;
    participantCount: number;
    toolUsageCount: number;
    contextReferences: number;
    complexity: number;
  };
}

/**
 * Overall conversation statistics
 */
export interface ConversationStatistics {
  totalSessions: number;
  totalTurns: number;
  totalDuration: number;
  averageSessionDuration: number;
  patternUsage: Record<CollaborationPattern, number>;
  topParticipants: { agentId: string; sessionCount: number }[];
  peakHours: { hour: number; sessionCount: number }[];
  complexityDistribution: { level: string; count: number }[];
}

/**
 * Conversation history manager for tracking and analyzing multi-agent conversations
 */
export class ConversationHistory extends EventEmitter {
  private sessions: Map<string, ConversationSession> = new Map();
  private turns: Map<string, ConversationTurn> = new Map();
  private threads: Map<string, ConversationThread> = new Map();
  
  // Indexing for performance
  private sessionsByAgent: Map<string, Set<string>> = new Map();
  private sessionsByPattern: Map<CollaborationPattern, Set<string>> = new Map();
  private turnsByTimestamp: Map<string, string[]> = new Map(); // date -> turnIds
  
  // Configuration
  private options: {
    maxSessions: number;
    maxTurnsPerSession: number;
    retentionDays: number;
    enableRealTimeAnalysis: boolean;
    compressionEnabled: boolean;
  };

  constructor(options: Partial<ConversationHistory['options']> = {}) {
    super();
    
    this.options = {
      maxSessions: 1000,
      maxTurnsPerSession: 10000,
      retentionDays: 90,
      enableRealTimeAnalysis: true,
      compressionEnabled: true,
      ...options
    };

    this.startPeriodicTasks();
  }

  /**
   * Create a new conversation session
   */
  async createSession(
    sessionId: string,
    name: string,
    pattern: CollaborationPattern,
    participants: AgentParticipation[]
  ): Promise<ConversationSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session: ConversationSession = {
      id: sessionId,
      name,
      pattern,
      participants,
      startTime: new Date(),
      status: 'active',
      turns: [],
      threads: [],
      flow: {
        sessionId,
        pattern,
        phases: [{
          name: 'initialization',
          startTime: new Date(),
          participants: participants.map(p => p.agentName),
          turnCount: 0,
          keyEvents: ['session_created']
        }],
        participationMetrics: participants.map(p => ({
          agentId: p.agentName,
          turnCount: 0,
          averageResponseTime: 0,
          toolUsageCount: 0,
          dominanceScore: 0
        })),
        timeline: [{
          timestamp: new Date(),
          event: 'turn',
          details: { type: 'session_start', participants: participants.length }
        }]
      },
      statistics: {
        totalTurns: 0,
        totalDuration: 0,
        averageTurnDuration: 0,
        participantCount: participants.length,
        toolUsageCount: 0,
        contextReferences: 0,
        complexity: 0
      }
    };

    this.sessions.set(sessionId, session);

    // Update indexes
    for (const participant of participants) {
      this.addToAgentIndex(participant.agentName, sessionId);
    }
    this.addToPatternIndex(pattern, sessionId);

    this.emit('session-created', {
      sessionId,
      session,
      timestamp: new Date()
    });

    return session;
  }

  /**
   * Add a conversation turn
   */
  async addTurn(
    sessionId: string,
    message: ConversationMessage,
    metadata: Partial<ConversationTurn['metadata']> = {}
  ): Promise<ConversationTurn> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw new Error(`Cannot add turn to ${session.status} session`);
    }

    const turnId = `turn_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sequenceNumber = session.turns.length + 1;
    const now = new Date();

    const turn: ConversationTurn = {
      id: turnId,
      message,
      sequenceNumber,
      turnDuration: 0, // Will be calculated when next turn arrives
      metadata: {
        responseTime: metadata.responseTime || 0,
        tokenCount: metadata.tokenCount || this.estimateTokenCount(message.content),
        ...metadata
      }
    };

    // Calculate turn duration from previous turn
    if (session.turns.length > 0) {
      const lastTurn = session.turns[session.turns.length - 1];
      const lastTurnTime = new Date(lastTurn.message.timestamp);
      turn.turnDuration = now.getTime() - lastTurnTime.getTime();
      lastTurn.turnDuration = turn.turnDuration;
    }

    // Add to session
    session.turns.push(turn);
    this.turns.set(turnId, turn);

    // Update session statistics
    this.updateSessionStatistics(session, turn);

    // Update flow analysis
    this.updateConversationFlow(session, turn);

    // Update timestamp index
    const dateKey = now.toISOString().split('T')[0];
    if (!this.turnsByTimestamp.has(dateKey)) {
      this.turnsByTimestamp.set(dateKey, []);
    }
    this.turnsByTimestamp.get(dateKey)!.push(turnId);

    // Check for thread creation/continuation
    if (this.options.enableRealTimeAnalysis) {
      await this.analyzeThreads(session, turn);
    }

    this.emit('turn-added', {
      sessionId,
      turnId,
      turn,
      sequenceNumber,
      timestamp: now
    });

    return turn;
  }

  /**
   * Complete a conversation session
   */
  async completeSession(sessionId: string): Promise<ConversationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'completed';
    session.endTime = new Date();

    // Final statistics calculation
    this.finalizeSessionStatistics(session);

    // Complete any active threads
    for (const thread of session.threads) {
      if (thread.status === 'active') {
        thread.status = 'completed';
        thread.endTurnId = session.turns[session.turns.length - 1]?.id;
      }
    }

    this.emit('session-completed', {
      sessionId,
      session,
      timestamp: new Date()
    });

    return session;
  }

  /**
   * Query conversation history
   */
  async queryHistory(query: HistoryQuery): Promise<{
    sessions: ConversationSession[];
    turns: ConversationTurn[];
    totalCount: number;
  }> {
    let candidateSessions = new Set<string>();

    // Apply filters
    if (query.sessionId) {
      candidateSessions.add(query.sessionId);
    } else {
      candidateSessions = new Set(this.sessions.keys());
    }

    if (query.agentId) {
      const agentSessions = this.sessionsByAgent.get(query.agentId) || new Set();
      candidateSessions = new Set([...candidateSessions].filter(id => agentSessions.has(id)));
    }

    if (query.pattern) {
      const patternSessions = this.sessionsByPattern.get(query.pattern) || new Set();
      candidateSessions = new Set([...candidateSessions].filter(id => patternSessions.has(id)));
    }

    // Filter sessions by time range
    const sessions: ConversationSession[] = [];
    for (const sessionId of candidateSessions) {
      const session = this.sessions.get(sessionId);
      if (!session) continue;

      if (query.timeRange) {
        const sessionStart = session.startTime.getTime();
        const queryStart = query.timeRange.from.getTime();
        const queryEnd = query.timeRange.to.getTime();
        
        if (sessionStart < queryStart || sessionStart > queryEnd) {
          continue;
        }
      }

      sessions.push(session);
    }

    // Collect turns
    let turns: ConversationTurn[] = [];
    for (const session of sessions) {
      let sessionTurns = session.turns;

      if (query.messageTypes) {
        sessionTurns = sessionTurns.filter(turn => 
          query.messageTypes!.includes(turn.message.role)
        );
      }

      turns.push(...sessionTurns);
    }

    // Sort results
    if (query.sortBy) {
      turns = this.sortTurns(turns, query.sortBy, query.sortOrder || 'desc');
    }

    // Apply pagination
    const totalCount = turns.length;
    if (query.offset) {
      turns = turns.slice(query.offset);
    }
    if (query.limit) {
      turns = turns.slice(0, query.limit);
    }

    return {
      sessions: sessions.slice(0, query.limit || sessions.length),
      turns,
      totalCount
    };
  }

  /**
   * Generate conversation statistics
   */
  generateStatistics(): ConversationStatistics {
    const stats: ConversationStatistics = {
      totalSessions: this.sessions.size,
      totalTurns: 0,
      totalDuration: 0,
      averageSessionDuration: 0,
      patternUsage: {} as Record<CollaborationPattern, number>,
      topParticipants: [],
      peakHours: [],
      complexityDistribution: []
    };

    const participantCounts = new Map<string, number>();
    const hourCounts = new Map<number, number>();
    const complexityCounts = new Map<string, number>();

    for (const session of this.sessions.values()) {
      stats.totalTurns += session.statistics.totalTurns;
      stats.totalDuration += session.statistics.totalDuration;

      // Pattern usage
      stats.patternUsage[session.pattern] = (stats.patternUsage[session.pattern] || 0) + 1;

      // Participant tracking
      for (const participant of session.participants) {
        participantCounts.set(
          participant.agentName,
          (participantCounts.get(participant.agentName) || 0) + 1
        );
      }

      // Peak hours
      const sessionHour = session.startTime.getHours();
      hourCounts.set(sessionHour, (hourCounts.get(sessionHour) || 0) + 1);

      // Complexity distribution
      const complexityLevel = this.getComplexityLevel(session.statistics.complexity);
      complexityCounts.set(complexityLevel, (complexityCounts.get(complexityLevel) || 0) + 1);
    }

    stats.averageSessionDuration = this.sessions.size > 0 ? 
      stats.totalDuration / this.sessions.size : 0;

    // Top participants
    stats.topParticipants = Array.from(participantCounts.entries())
      .map(([agentId, count]) => ({ agentId, sessionCount: count }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 10);

    // Peak hours
    stats.peakHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, sessionCount: count }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    // Complexity distribution
    stats.complexityDistribution = Array.from(complexityCounts.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count);

    return stats;
  }

  /**
   * Export conversation data
   */
  async exportConversations(
    format: ConversationExport['format'],
    query?: HistoryQuery,
    options: {
      includePersonalData?: boolean;
      anonymize?: boolean;
    } = {}
  ): Promise<ConversationExport> {
    const historyResult = await this.queryHistory(query || {});
    const statistics = this.generateStatistics();

    const exportData: ConversationExport = {
      format,
      data: {
        sessions: historyResult.sessions,
        statistics,
        exportMetadata: {
          timestamp: new Date(),
          version: '1.0.0',
          includePersonalData: options.includePersonalData || false,
          anonymized: options.anonymize || false
        }
      }
    };

    if (options.anonymize) {
      this.anonymizeExportData(exportData);
    }

    this.emit('data-exported', {
      format,
      sessionCount: historyResult.sessions.length,
      turnCount: historyResult.turns.length,
      timestamp: new Date()
    });

    return exportData;
  }

  /**
   * Archive old sessions
   */
  async archiveOldSessions(): Promise<{ archived: number; deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

    let archived = 0;
    let deleted = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.startTime < cutoffDate) {
        if (session.status === 'completed') {
          session.status = 'archived';
          archived++;
        } else {
          // Delete very old incomplete sessions
          this.deleteSession(sessionId);
          deleted++;
        }
      }
    }

    this.emit('sessions-archived', {
      archived,
      deleted,
      cutoffDate,
      timestamp: new Date()
    });

    return { archived, deleted };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  /**
   * Get conversation flow for a session
   */
  getConversationFlow(sessionId: string): ConversationFlow | undefined {
    const session = this.sessions.get(sessionId);
    return session?.flow;
  }

  /**
   * Get threads for a session
   */
  getSessionThreads(sessionId: string): ConversationThread[] {
    const session = this.sessions.get(sessionId);
    return session?.threads || [];
  }

  /**
   * Private helper methods
   */
  private updateSessionStatistics(session: ConversationSession, turn: ConversationTurn): void {
    session.statistics.totalTurns++;
    session.statistics.totalDuration += turn.turnDuration;
    session.statistics.averageTurnDuration = 
      session.statistics.totalDuration / session.statistics.totalTurns;

    if (turn.metadata.toolsUsed) {
      session.statistics.toolUsageCount += turn.metadata.toolsUsed.length;
    }

    if (turn.metadata.contextReferences) {
      session.statistics.contextReferences += turn.metadata.contextReferences.length;
    }

    // Update complexity based on various factors
    session.statistics.complexity = this.calculateComplexity(session);
  }

  private updateConversationFlow(session: ConversationSession, turn: ConversationTurn): void {
    const flow = session.flow;
    
    // Update participation metrics
    const participantMetric = flow.participationMetrics.find(p => p.agentId === turn.message.agentId);
    if (participantMetric) {
      participantMetric.turnCount++;
      if (turn.metadata.responseTime) {
        participantMetric.averageResponseTime = 
          (participantMetric.averageResponseTime * (participantMetric.turnCount - 1) + turn.metadata.responseTime) / 
          participantMetric.turnCount;
      }
      if (turn.metadata.toolsUsed) {
        participantMetric.toolUsageCount += turn.metadata.toolsUsed.length;
      }
    }

    // Add timeline event
    flow.timeline.push({
      timestamp: new Date(turn.message.timestamp),
      event: 'turn',
      details: {
        agentId: turn.message.agentId,
        sequenceNumber: turn.sequenceNumber,
        toolsUsed: turn.metadata.toolsUsed?.length || 0
      }
    });

    // Update current phase
    const currentPhase = flow.phases[flow.phases.length - 1];
    currentPhase.turnCount++;
    
    if (turn.metadata.patternPhase && turn.metadata.patternPhase !== currentPhase.name) {
      // Start new phase
      currentPhase.endTime = new Date(turn.message.timestamp);
      flow.phases.push({
        name: turn.metadata.patternPhase,
        startTime: new Date(turn.message.timestamp),
        participants: [turn.message.agentId],
        turnCount: 1,
        keyEvents: [`phase_started:${turn.metadata.patternPhase}`]
      });

      flow.timeline.push({
        timestamp: new Date(turn.message.timestamp),
        event: 'phase_change',
        details: {
          from: currentPhase.name,
          to: turn.metadata.patternPhase
        }
      });
    }
  }

  private async analyzeThreads(session: ConversationSession, turn: ConversationTurn): Promise<void> {
    // Simple thread detection based on topic continuity and participant patterns
    // This could be enhanced with NLP for better topic detection
    
    const recentTurns = session.turns.slice(-5); // Look at last 5 turns
    const isNewTopic = this.isNewTopicStart(turn, recentTurns);

    if (isNewTopic || session.threads.length === 0) {
      // Start new thread
      const threadId = `thread_${session.id}_${session.threads.length + 1}`;
      const thread: ConversationThread = {
        id: threadId,
        sessionId: session.id,
        startTurnId: turn.id,
        turns: [turn],
        participants: [turn.message.agentId],
        topic: this.extractTopic(turn),
        summary: '',
        status: 'active',
        metadata: {
          complexity: 1,
          totalDuration: turn.turnDuration,
          toolUsageCount: turn.metadata.toolsUsed?.length || 0,
          contextSize: turn.metadata.contextReferences?.length || 0
        }
      };

      session.threads.push(thread);
      this.threads.set(threadId, thread);
    } else {
      // Continue current thread
      const currentThread = session.threads[session.threads.length - 1];
      currentThread.turns.push(turn);
      
      if (!currentThread.participants.includes(turn.message.agentId)) {
        currentThread.participants.push(turn.message.agentId);
      }

      currentThread.metadata.totalDuration += turn.turnDuration;
      currentThread.metadata.toolUsageCount += turn.metadata.toolsUsed?.length || 0;
      currentThread.metadata.contextSize += turn.metadata.contextReferences?.length || 0;
      currentThread.metadata.complexity = this.calculateThreadComplexity(currentThread);
    }
  }

  private calculateComplexity(session: ConversationSession): number {
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
  }

  private calculateThreadComplexity(thread: ConversationThread): number {
    let complexity = 0;
    
    complexity += Math.log(thread.turns.length + 1);
    complexity += thread.participants.length * 0.5;
    complexity += Math.log(thread.metadata.toolUsageCount + 1) * 0.3;
    complexity += Math.log(thread.metadata.contextSize + 1) * 0.2;
    
    return Math.min(complexity, 10);
  }

  private isNewTopicStart(turn: ConversationTurn, recentTurns: ConversationTurn[]): boolean {
    // Simple heuristics for topic change detection
    const content = turn.message.content.toLowerCase();
    
    // Look for topic transition words
    const topicTransitions = [
      'now let\'s', 'moving on', 'next topic', 'switching to', 
      'on another note', 'changing subjects', 'new question'
    ];
    
    return topicTransitions.some(phrase => content.includes(phrase));
  }

  private extractTopic(turn: ConversationTurn): string {
    // Simple topic extraction - could be enhanced with NLP
    const content = turn.message.content;
    const words = content.split(' ').filter(word => word.length > 3);
    return words.slice(0, 3).join(' '); // Take first 3 meaningful words
  }

  private finalizeSessionStatistics(session: ConversationSession): void {
    // Calculate dominance scores
    const totalTurns = session.statistics.totalTurns;
    for (const metric of session.flow.participationMetrics) {
      metric.dominanceScore = totalTurns > 0 ? metric.turnCount / totalTurns : 0;
    }

    // Generate session summary
    if (session.threads.length > 0) {
      for (const thread of session.threads) {
        thread.summary = this.generateThreadSummary(thread);
      }
    }
  }

  private generateThreadSummary(thread: ConversationThread): string {
    const turnCount = thread.turns.length;
    const participantList = thread.participants.join(', ');
    const duration = Math.round(thread.metadata.totalDuration / 1000 / 60); // minutes
    
    return `${turnCount} turns between ${participantList} over ${duration} minutes discussing ${thread.topic}`;
  }

  private getComplexityLevel(complexity: number): string {
    if (complexity < 2) return 'simple';
    if (complexity < 4) return 'moderate';
    if (complexity < 6) return 'complex';
    if (complexity < 8) return 'highly_complex';
    return 'expert_level';
  }

  private sortTurns(
    turns: ConversationTurn[],
    sortBy: 'timestamp' | 'sequence' | 'relevance',
    order: 'asc' | 'desc'
  ): ConversationTurn[] {
    return turns.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'timestamp':
          comparison = new Date(a.message.timestamp).getTime() - new Date(b.message.timestamp).getTime();
          break;
        case 'sequence':
          comparison = a.sequenceNumber - b.sequenceNumber;
          break;
        case 'relevance':
          // Simple relevance based on metadata richness
          const aRelevance = (a.metadata.toolsUsed?.length || 0) + (a.metadata.contextReferences?.length || 0);
          const bRelevance = (b.metadata.toolsUsed?.length || 0) + (b.metadata.contextReferences?.length || 0);
          comparison = aRelevance - bRelevance;
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  }

  private estimateTokenCount(content: string): number {
    // Simple token estimation - roughly 4 characters per token
    return Math.ceil(content.length / 4);
  }

  private anonymizeExportData(exportData: ConversationExport): void {
    const agentMapping = new Map<string, string>();
    let agentCounter = 1;

    for (const session of exportData.data.sessions) {
      // Anonymize participant names
      for (const participant of session.participants) {
        if (!agentMapping.has(participant.agentName)) {
          agentMapping.set(participant.agentName, `Agent_${agentCounter++}`);
        }
        participant.agentName = agentMapping.get(participant.agentName)!;
      }

      // Anonymize turn content
      for (const turn of session.turns) {
        if (!agentMapping.has(turn.message.agentId)) {
          agentMapping.set(turn.message.agentId, `Agent_${agentCounter++}`);
        }
        turn.message.agentId = agentMapping.get(turn.message.agentId)!;
        
        // Basic content anonymization
        turn.message.content = this.anonymizeContent(turn.message.content);
      }

      // Anonymize flow metrics
      for (const metric of session.flow.participationMetrics) {
        metric.agentId = agentMapping.get(metric.agentId) || metric.agentId;
      }
    }

    // Update statistics
    exportData.data.statistics.topParticipants = exportData.data.statistics.topParticipants.map(p => ({
      agentId: agentMapping.get(p.agentId) || p.agentId,
      sessionCount: p.sessionCount
    }));
  }

  private anonymizeContent(content: string): string {
    // Basic content anonymization - replace potential names and identifiers
    return content
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[Name]') // Names
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[Phone]') // Phone numbers
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[Email]'); // Emails
  }

  private addToAgentIndex(agentId: string, sessionId: string): void {
    if (!this.sessionsByAgent.has(agentId)) {
      this.sessionsByAgent.set(agentId, new Set());
    }
    this.sessionsByAgent.get(agentId)!.add(sessionId);
  }

  private addToPatternIndex(pattern: CollaborationPattern, sessionId: string): void {
    if (!this.sessionsByPattern.has(pattern)) {
      this.sessionsByPattern.set(pattern, new Set());
    }
    this.sessionsByPattern.get(pattern)!.add(sessionId);
  }

  private deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from indexes
    for (const participant of session.participants) {
      this.sessionsByAgent.get(participant.agentName)?.delete(sessionId);
    }
    this.sessionsByPattern.get(session.pattern)?.delete(sessionId);

    // Remove turns from timestamp index
    for (const turn of session.turns) {
      const dateKey = new Date(turn.message.timestamp).toISOString().split('T')[0];
      const dayTurns = this.turnsByTimestamp.get(dateKey);
      if (dayTurns) {
        const index = dayTurns.indexOf(turn.id);
        if (index > -1) {
          dayTurns.splice(index, 1);
        }
      }
      this.turns.delete(turn.id);
    }

    // Remove threads
    for (const thread of session.threads) {
      this.threads.delete(thread.id);
    }

    this.sessions.delete(sessionId);
  }

  private startPeriodicTasks(): void {
    // Archive old sessions every hour
    setInterval(() => {
      this.archiveOldSessions();
    }, 60 * 60 * 1000);

    // Cleanup expired data every 6 hours
    setInterval(() => {
      this.performCleanup();
    }, 6 * 60 * 60 * 1000);
  }

  private performCleanup(): void {
    // Remove empty date entries from timestamp index
    for (const [dateKey, turnIds] of this.turnsByTimestamp) {
      if (turnIds.length === 0) {
        this.turnsByTimestamp.delete(dateKey);
      }
    }

    // Remove empty agent indexes
    for (const [agentId, sessionIds] of this.sessionsByAgent) {
      if (sessionIds.size === 0) {
        this.sessionsByAgent.delete(agentId);
      }
    }

    this.emit('cleanup-performed', {
      timestamp: new Date(),
      sessionsCount: this.sessions.size,
      turnsCount: this.turns.size,
      threadsCount: this.threads.size
    });
  }
}