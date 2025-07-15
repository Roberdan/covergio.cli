/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'events';
import {
  AutoGenAgentConfig,
  ConversationMessage,
  CollaborationPattern,
  AutoGenError
} from '../types';

/**
 * Agent participation configuration for collaboration
 */
export interface AgentParticipation {
  agentName: string;
  role: 'moderator' | 'participant' | 'observer' | 'specialist';
  priority: number;
  canInitiate: boolean;
  canInterrupt: boolean;
  maxConsecutiveTurns: number;
  specializations?: string[];
}

/**
 * Turn-taking rules for conversation management
 */
export interface TurnTakingRules {
  maxTurnsPerAgent: number;
  allowConsecutiveTurns: boolean;
  prioritizeExpertise: boolean;
  interruptionPolicy: 'never' | 'moderator-only' | 'all-agents' | 'priority-based';
  timeoutBetweenTurns: number;
  maxConversationTurns: number;
}

/**
 * Conversation state tracking
 */
export interface ConversationState {
  id: string;
  participants: AgentParticipation[];
  pattern: CollaborationPattern;
  currentSpeaker: string | null;
  turnCount: number;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed';
  context: Record<string, any>;
  history: ConversationMessage[];
  startTime: Date;
  lastActivity: Date;
}

/**
 * Collaboration outcome tracking
 */
export interface CollaborationOutcome {
  success: boolean;
  consensusReached: boolean;
  finalDecision?: string;
  participantSatisfaction: Record<string, number>;
  keyInsights: string[];
  unresolved: string[];
  executionTime: number;
}

/**
 * Abstract base class for collaboration patterns
 */
export abstract class BaseCollaborationPattern extends EventEmitter {
  protected state: ConversationState;
  protected rules: TurnTakingRules;
  protected outcome: CollaborationOutcome | null = null;

  constructor(
    conversationId: string,
    participants: AgentParticipation[],
    rules: Partial<TurnTakingRules> = {}
  ) {
    super();
    
    this.rules = {
      maxTurnsPerAgent: 3,
      allowConsecutiveTurns: false,
      prioritizeExpertise: true,
      interruptionPolicy: 'moderator-only',
      timeoutBetweenTurns: 5000,
      maxConversationTurns: 50,
      ...rules
    };

    this.state = {
      id: conversationId,
      participants,
      pattern: this.getPatternType(),
      currentSpeaker: null,
      turnCount: 0,
      status: 'initializing',
      context: {},
      history: [],
      startTime: new Date(),
      lastActivity: new Date()
    };
  }

  /**
   * Get the pattern type implemented by this class
   */
  abstract getPatternType(): CollaborationPattern;

  /**
   * Initialize the collaboration session
   */
  async initialize(initialMessage?: string): Promise<void> {
    try {
      this.state.status = 'active';
      this.state.startTime = new Date();

      if (initialMessage) {
        await this.addMessage({
          role: 'system',
          content: initialMessage,
          timestamp: new Date().toISOString(),
          agent_id: 'system'
        });
      }

      const firstSpeaker = this.selectNextSpeaker();
      if (firstSpeaker) {
        this.state.currentSpeaker = firstSpeaker.agentName;
      }

      this.emit('collaboration-initialized', {
        conversationId: this.state.id,
        pattern: this.getPatternType(),
        participants: this.state.participants,
        firstSpeaker: this.state.currentSpeaker
      });

    } catch (error) {
      this.state.status = 'failed';
      throw new AutoGenError(
        `Failed to initialize collaboration: ${error.message}`,
        'COLLABORATION_INIT_ERROR',
        { conversationId: this.state.id, error }
      );
    }
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    this.state.history.push(message);
    this.state.lastActivity = new Date();
    this.state.turnCount++;

    this.emit('message-added', {
      conversationId: this.state.id,
      message,
      turnCount: this.state.turnCount
    });

    // Check if we need to change speakers
    if (this.shouldChangeSpeaker(message)) {
      await this.handleSpeakerTransition();
    }

    // Check for conversation completion
    if (this.isConversationComplete()) {
      await this.completeCollaboration();
    }
  }

  /**
   * Handle speaker transitions based on pattern rules
   */
  protected async handleSpeakerTransition(): Promise<void> {
    const nextSpeaker = this.selectNextSpeaker();
    const previousSpeaker = this.state.currentSpeaker;
    
    this.state.currentSpeaker = nextSpeaker?.agentName || null;

    this.emit('speaker-changed', {
      conversationId: this.state.id,
      previousSpeaker,
      currentSpeaker: this.state.currentSpeaker,
      turnCount: this.state.turnCount
    });
  }

  /**
   * Select the next speaker based on pattern-specific logic
   */
  abstract selectNextSpeaker(): AgentParticipation | null;

  /**
   * Determine if speaker should change based on pattern rules
   */
  abstract shouldChangeSpeaker(message: ConversationMessage): boolean;

  /**
   * Check if the conversation is complete
   */
  protected isConversationComplete(): boolean {
    if (this.state.turnCount >= this.rules.maxConversationTurns) {
      return true;
    }

    if (this.hasConsensus()) {
      return true;
    }

    if (this.hasTimeout()) {
      return true;
    }

    return false;
  }

  /**
   * Check if consensus has been reached
   */
  protected hasConsensus(): boolean {
    // Look for consensus indicators in recent messages
    const recentMessages = this.state.history.slice(-5);
    const consensusKeywords = [
      'agreed', 'consensus', 'decision', 'final', 'concluded',
      'resolved', 'settled', 'unanimous', 'accepted'
    ];

    return recentMessages.some(msg => 
      consensusKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    );
  }

  /**
   * Check if conversation has timed out
   */
  protected hasTimeout(): boolean {
    const timeSinceLastActivity = Date.now() - this.state.lastActivity.getTime();
    return timeSinceLastActivity > (this.rules.timeoutBetweenTurns * 10); // 10x normal timeout
  }

  /**
   * Complete the collaboration and generate outcome
   */
  protected async completeCollaboration(): Promise<void> {
    this.state.status = 'completed';
    
    this.outcome = {
      success: this.state.status === 'completed',
      consensusReached: this.hasConsensus(),
      participantSatisfaction: this.calculateSatisfaction(),
      keyInsights: this.extractKeyInsights(),
      unresolved: this.identifyUnresolvedIssues(),
      executionTime: Date.now() - this.state.startTime.getTime()
    };

    this.emit('collaboration-completed', {
      conversationId: this.state.id,
      outcome: this.outcome,
      finalState: this.state
    });
  }

  /**
   * Calculate participant satisfaction scores
   */
  protected calculateSatisfaction(): Record<string, number> {
    const satisfaction: Record<string, number> = {};
    
    for (const participant of this.state.participants) {
      // Calculate based on participation frequency and response quality
      const messagesToAgent = this.state.history.filter(msg => 
        msg.agent_id === participant.agentName
      ).length;
      
      const expectedMessages = Math.floor(this.state.turnCount / this.state.participants.length);
      const participationRatio = messagesToAgent / Math.max(expectedMessages, 1);
      
      // Simple satisfaction metric (0-1 scale)
      satisfaction[participant.agentName] = Math.min(1, participationRatio * 0.8 + 0.2);
    }
    
    return satisfaction;
  }

  /**
   * Extract key insights from the conversation
   */
  protected extractKeyInsights(): string[] {
    const insights: string[] = [];
    
    // Look for messages containing insights keywords
    const insightKeywords = [
      'insight', 'important', 'key point', 'crucial', 'significant',
      'realize', 'understand', 'discovery', 'conclusion'
    ];

    for (const message of this.state.history) {
      if (insightKeywords.some(keyword => 
        message.content.toLowerCase().includes(keyword)
      )) {
        insights.push(message.content.substring(0, 200) + '...');
      }
    }

    return insights.slice(0, 5); // Return top 5 insights
  }

  /**
   * Identify unresolved issues
   */
  protected identifyUnresolvedIssues(): string[] {
    const unresolved: string[] = [];
    
    // Look for unresolved questions or conflicts
    const unresolvedKeywords = [
      'unresolved', 'unclear', 'question', 'concern', 'issue',
      'problem', 'disagreement', 'conflict', 'need more'
    ];

    for (const message of this.state.history) {
      if (unresolvedKeywords.some(keyword => 
        message.content.toLowerCase().includes(keyword)
      )) {
        unresolved.push(message.content.substring(0, 200) + '...');
      }
    }

    return unresolved.slice(0, 3); // Return top 3 unresolved issues
  }

  /**
   * Pause the collaboration
   */
  async pause(): Promise<void> {
    this.state.status = 'paused';
    this.emit('collaboration-paused', {
      conversationId: this.state.id,
      pausedAt: new Date()
    });
  }

  /**
   * Resume the collaboration
   */
  async resume(): Promise<void> {
    this.state.status = 'active';
    this.state.lastActivity = new Date();
    this.emit('collaboration-resumed', {
      conversationId: this.state.id,
      resumedAt: new Date()
    });
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Get collaboration outcome (if completed)
   */
  getOutcome(): CollaborationOutcome | null {
    return this.outcome ? { ...this.outcome } : null;
  }

  /**
   * Get participant by agent name
   */
  protected getParticipant(agentName: string): AgentParticipation | undefined {
    return this.state.participants.find(p => p.agentName === agentName);
  }

  /**
   * Count turns for a specific agent
   */
  protected countAgentTurns(agentName: string): number {
    return this.state.history.filter(msg => msg.agent_id === agentName).length;
  }

  /**
   * Get last N messages
   */
  protected getRecentMessages(count: number): ConversationMessage[] {
    return this.state.history.slice(-count);
  }
}