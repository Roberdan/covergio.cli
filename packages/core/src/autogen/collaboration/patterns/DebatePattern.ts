/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  BaseCollaborationPattern, 
  AgentParticipation,
  TurnTakingRules
} from '../CollaborationPattern';
import { 
  CollaborationPattern, 
  ConversationMessage 
} from '../../types';

/**
 * Position in a debate
 */
interface DebatePosition {
  id: string;
  title: string;
  description: string;
  supporters: string[];
  arguments: string[];
  counterArguments: string[];
  evidenceStrength: number;
}

/**
 * Debate scoring system
 */
interface DebateScore {
  agentName: string;
  argumentQuality: number;
  evidenceProvided: number;
  logicalConsistency: number;
  persuasiveness: number;
  total: number;
}

/**
 * Debate collaboration pattern - structured argumentation between agents
 */
export class DebatePattern extends BaseCollaborationPattern {
  private positions: Map<string, DebatePosition> = new Map();
  private currentPhase: 'opening' | 'argumentation' | 'rebuttal' | 'closing' | 'judgment' = 'opening';
  private moderator: string | null = null;
  private debateRounds: number = 0;
  private maxRounds: number;
  private scores: Map<string, DebateScore> = new Map();

  constructor(
    conversationId: string,
    participants: AgentParticipation[],
    rules: Partial<TurnTakingRules> = {},
    maxRounds: number = 3
  ) {
    super(conversationId, participants, {
      allowConsecutiveTurns: false,
      interruptionPolicy: 'moderator-only',
      maxTurnsPerAgent: 2,
      ...rules
    });

    this.maxRounds = maxRounds;
    
    // Find moderator
    this.moderator = participants
      .filter(p => p.role === 'moderator')
      .sort((a, b) => b.priority - a.priority)[0]?.agentName || null;

    // Initialize scoring for each participant
    for (const participant of participants) {
      if (participant.role !== 'moderator') {
        this.scores.set(participant.agentName, {
          agentName: participant.agentName,
          argumentQuality: 0,
          evidenceProvided: 0,
          logicalConsistency: 0,
          persuasiveness: 0,
          total: 0
        });
      }
    }
  }

  getPatternType(): CollaborationPattern {
    return CollaborationPattern.DEBATE;
  }

  selectNextSpeaker(): AgentParticipation | null {
    switch (this.currentPhase) {
      case 'opening':
        return this.selectForOpeningStatements();
      
      case 'argumentation':
      case 'rebuttal':
        return this.selectForDebateRound();
      
      case 'closing':
        return this.selectForClosingStatements();
      
      case 'judgment':
        return this.getParticipant(this.moderator!) || null;
      
      default:
        return null;
    }
  }

  shouldChangeSpeaker(message: ConversationMessage): boolean {
    // In debate pattern, strict turn-taking is enforced
    if (this.currentPhase === 'judgment' && message.agent_id === this.moderator) {
      // Moderator can continue for final judgment
      return false;
    }

    // Always change speaker after each statement in debate
    return true;
  }

  /**
   * Define debate positions
   */
  async definePositions(positions: Omit<DebatePosition, 'supporters' | 'arguments' | 'counterArguments' | 'evidenceStrength'>[]): Promise<void> {
    for (const position of positions) {
      this.positions.set(position.id, {
        ...position,
        supporters: [],
        arguments: [],
        counterArguments: [],
        evidenceStrength: 0
      });
    }

    this.emit('positions-defined', {
      conversationId: this.state.id,
      positions: Array.from(this.positions.values())
    });
  }

  /**
   * Assign agent to a position
   */
  async assignPosition(agentName: string, positionId: string): Promise<void> {
    const position = this.positions.get(positionId);
    if (position && !position.supporters.includes(agentName)) {
      position.supporters.push(agentName);
      
      this.emit('position-assigned', {
        conversationId: this.state.id,
        agentName,
        positionId,
        position
      });
    }
  }

  /**
   * Select speaker for opening statements
   */
  private selectForOpeningStatements(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'moderator');
    
    // Find agents who haven't given opening statements
    const spokesPersons = participants.filter(p => {
      const hasSpoken = this.state.history.some(msg => 
        msg.agent_id === p.agentName && this.currentPhase === 'opening'
      );
      return !hasSpoken;
    });

    if (spokesPersons.length === 0) {
      this.advanceToNextPhase();
      return this.selectNextSpeaker();
    }

    // Select by priority
    return spokesPersons.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Select speaker for debate rounds
   */
  private selectForDebateRound(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'moderator');
    
    // Alternate between different positions
    const recentSpeakers = this.getRecentMessages(3).map(msg => msg.agent_id);
    const availableSpeakers = participants.filter(p => 
      !recentSpeakers.includes(p.agentName)
    );

    if (availableSpeakers.length === 0) {
      // All have spoken recently, advance round or phase
      this.debateRounds++;
      if (this.debateRounds >= this.maxRounds) {
        this.advanceToNextPhase();
        return this.selectNextSpeaker();
      }
      return participants[0]; // Reset with first participant
    }

    // Select agent from different position than last speaker
    const lastMessage = this.getRecentMessages(1)[0];
    if (lastMessage) {
      const lastSpeakerPosition = this.getAgentPosition(lastMessage.agent_id);
      const opposingAgents = availableSpeakers.filter(p => 
        this.getAgentPosition(p.agentName) !== lastSpeakerPosition
      );
      
      if (opposingAgents.length > 0) {
        return opposingAgents.sort((a, b) => b.priority - a.priority)[0];
      }
    }

    return availableSpeakers.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Select speaker for closing statements
   */
  private selectForClosingStatements(): AgentParticipation | null {
    const participants = this.state.participants.filter(p => p.role !== 'moderator');
    
    // Find agents who haven't given closing statements
    const remaining = participants.filter(p => {
      const hasSpoken = this.state.history.some(msg => 
        msg.agent_id === p.agentName && this.currentPhase === 'closing'
      );
      return !hasSpoken;
    });

    if (remaining.length === 0) {
      this.advanceToNextPhase();
      return this.selectNextSpeaker();
    }

    return remaining.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Advance to the next debate phase
   */
  private advanceToNextPhase(): void {
    const phases = ['opening', 'argumentation', 'rebuttal', 'closing', 'judgment'] as const;
    const currentIndex = phases.indexOf(this.currentPhase);
    
    if (currentIndex < phases.length - 1) {
      this.currentPhase = phases[currentIndex + 1];
      
      this.emit('phase-changed', {
        conversationId: this.state.id,
        newPhase: this.currentPhase,
        debateRounds: this.debateRounds
      });
    }
  }

  /**
   * Get agent's debate position
   */
  private getAgentPosition(agentName: string): string | null {
    for (const [positionId, position] of this.positions) {
      if (position.supporters.includes(agentName)) {
        return positionId;
      }
    }
    return null;
  }

  /**
   * Score a debate contribution
   */
  private scoreContribution(message: ConversationMessage): void {
    const score = this.scores.get(message.agent_id);
    if (!score) return;

    // Simple scoring based on message content analysis
    const content = message.content.toLowerCase();
    
    // Argument quality (presence of reasoning words)
    const reasoningWords = ['because', 'therefore', 'since', 'consequently', 'thus', 'hence'];
    const reasoningScore = reasoningWords.filter(word => content.includes(word)).length;
    score.argumentQuality += Math.min(reasoningScore * 0.2, 1.0);

    // Evidence (presence of factual indicators)
    const evidenceWords = ['study', 'research', 'data', 'statistics', 'fact', 'evidence'];
    const evidenceScore = evidenceWords.filter(word => content.includes(word)).length;
    score.evidenceProvided += Math.min(evidenceScore * 0.3, 1.0);

    // Logical consistency (lack of contradiction indicators)
    const contradictionWords = ['however', 'but', 'although', 'despite'];
    const contradictionPenalty = contradictionWords.filter(word => content.includes(word)).length;
    score.logicalConsistency = Math.max(0, score.logicalConsistency + 0.1 - contradictionPenalty * 0.1);

    // Persuasiveness (engaging language)
    const persuasiveWords = ['important', 'crucial', 'significant', 'clearly', 'obviously'];
    const persuasiveScore = persuasiveWords.filter(word => content.includes(word)).length;
    score.persuasiveness += Math.min(persuasiveScore * 0.15, 1.0);

    // Calculate total
    score.total = (score.argumentQuality + score.evidenceProvided + 
                  score.logicalConsistency + score.persuasiveness) / 4;

    this.emit('contribution-scored', {
      conversationId: this.state.id,
      agentName: message.agent_id,
      score: { ...score }
    });
  }

  /**
   * Get current debate status
   */
  getDebateStatus(): {
    phase: string;
    round: number;
    maxRounds: number;
    positions: DebatePosition[];
    scores: DebateScore[];
  } {
    return {
      phase: this.currentPhase,
      round: this.debateRounds,
      maxRounds: this.maxRounds,
      positions: Array.from(this.positions.values()),
      scores: Array.from(this.scores.values())
    };
  }

  /**
   * Get debate winner based on scores
   */
  getWinner(): { agentName: string; score: DebateScore } | null {
    const scores = Array.from(this.scores.values());
    if (scores.length === 0) return null;

    const winner = scores.reduce((best, current) => 
      current.total > best.total ? current : best
    );

    return { agentName: winner.agentName, score: winner };
  }

  /**
   * Override to handle scoring and phase transitions
   */
  async addMessage(message: ConversationMessage): Promise<void> {
    // Score non-moderator contributions
    if (message.agent_id !== this.moderator && message.role !== 'system') {
      this.scoreContribution(message);
    }

    await super.addMessage(message);
  }

  /**
   * Override completion check for debate-specific logic
   */
  protected isConversationComplete(): boolean {
    if (this.currentPhase === 'judgment') {
      return this.hasConsensus() || this.state.turnCount > this.rules.maxConversationTurns;
    }

    return super.isConversationComplete();
  }
}